import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { base } from "../__core/app";
import { db } from "../database";
import * as schema from "../database/schema";
import { hydrateJob, runScrape, needsScrape } from "../lib/scrape";
import { BOARDS } from "../lib/sources";
import { profileContext } from "../agent/profile";
import { scoreJobs } from "../agent/match";

type JobRow = typeof schema.jobs.$inferSelect;

async function userProfile(userId: string) {
  const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
  return row ?? null;
}

/** Cheap lexical pre-filter so the LLM only scores plausible rows. */
function relevance(job: JobRow, titles: string[], industries: string[]) {
  const haystack = `${job.title} ${job.team ?? ""}`.toLowerCase();
  let score = 0;
  for (const title of titles) {
    const words = title.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (!words.length) continue;
    const hits = words.filter((w) => haystack.includes(w)).length;
    if (hits === words.length) score += 10;
    else score += hits * 2;
  }
  for (const ind of industries) {
    if ((job.companyCategory ?? "").toLowerCase().includes(ind.toLowerCase())) score += 1;
  }
  return score;
}

export const jobs = {
  /** Board coverage, for the landing page and settings. */
  sources: base.handler(() => ({
    boards: BOARDS.length,
    companies: [...new Set(BOARDS.map((b) => b.company))].sort(),
    greenhouse: BOARDS.filter((b) => b.source === "greenhouse").length,
    lever: BOARDS.filter((b) => b.source === "lever").length,
  })),

  stats: base.handler(async () => {
    const [counts] = await db
      .select({
        total: sql<number>`count(*)`,
        remote: sql<number>`sum(case when ${schema.jobs.isRemote} then 1 else 0 end)`,
        companies: sql<number>`count(distinct ${schema.jobs.company})`,
      })
      .from(schema.jobs)
      .where(eq(schema.jobs.active, true));
    const [lastRun] = await db
      .select()
      .from(schema.scrapeRuns)
      .where(eq(schema.scrapeRuns.status, "done"))
      .orderBy(desc(schema.scrapeRuns.startedAt))
      .limit(1);
    return {
      total: Number(counts?.total ?? 0),
      remote: Number(counts?.remote ?? 0),
      companies: Number(counts?.companies ?? 0),
      lastRefreshedAt: lastRun?.finishedAt ?? null,
      stale: await needsScrape(24),
    };
  }),

  /** The user's job feed: active listings with their match score and application state. */
  feed: authed
    .input(
      z.object({
        search: z.string().max(120).optional(),
        source: z.enum(["all", "greenhouse", "lever"]).default("all"),
        remoteOnly: z.boolean().default(false),
        minScore: z.number().min(0).max(100).default(0),
        sort: z.enum(["score", "newest"]).default("score"),
        limit: z.number().min(1).max(100).default(40),
        offset: z.number().min(0).default(0),
      }),
    )
    .handler(async ({ input, context }) => {
      const filters = [eq(schema.jobs.active, true)];
      if (input.source !== "all") filters.push(eq(schema.jobs.source, input.source));
      if (input.remoteOnly) filters.push(eq(schema.jobs.isRemote, true));
      if (input.search?.trim()) {
        const q = `%${input.search.trim().toLowerCase()}%`;
        filters.push(
          sql`(lower(${schema.jobs.title}) like ${q} or lower(${schema.jobs.company}) like ${q} or lower(coalesce(${schema.jobs.location},'')) like ${q})`,
        );
      }

      const rows = await db
        .select({
          // Deliberately no `description` — the feed would otherwise ship megabytes of HTML.
          id: schema.jobs.id,
          source: schema.jobs.source,
          company: schema.jobs.company,
          companyCategory: schema.jobs.companyCategory,
          title: schema.jobs.title,
          location: schema.jobs.location,
          isRemote: schema.jobs.isRemote,
          team: schema.jobs.team,
          commitment: schema.jobs.commitment,
          url: schema.jobs.url,
          applyUrl: schema.jobs.applyUrl,
          postedAt: schema.jobs.postedAt,
          firstSeenAt: schema.jobs.firstSeenAt,
          score: schema.matches.score,
          reasoning: schema.matches.reasoning,
          strengths: schema.matches.strengths,
          gaps: schema.matches.gaps,
          applicationId: schema.applications.id,
          applicationStatus: schema.applications.status,
        })
        .from(schema.jobs)
        .leftJoin(
          schema.matches,
          and(eq(schema.matches.jobId, schema.jobs.id), eq(schema.matches.userId, context.user.id)),
        )
        .leftJoin(
          schema.applications,
          and(eq(schema.applications.jobId, schema.jobs.id), eq(schema.applications.userId, context.user.id)),
        )
        .where(and(...filters))
        .orderBy(
          input.sort === "score"
            ? sql`${schema.matches.score} desc nulls last, ${schema.jobs.postedAt} desc`
            : sql`${schema.jobs.postedAt} desc nulls last, ${schema.jobs.id} desc`,
        )
        .limit(input.limit)
        .offset(input.offset);

      const filtered = input.minScore > 0 ? rows.filter((r) => (r.score ?? 0) >= input.minScore) : rows;

      const [scored] = await db
        .select({ n: sql<number>`count(*)` })
        .from(schema.matches)
        .where(eq(schema.matches.userId, context.user.id));

      return { items: filtered, scoredCount: Number(scored?.n ?? 0) };
    }),

  get: authed.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const job = await hydrateJob(input.id);
    if (!job) throw new ORPCError("NOT_FOUND", { message: "Job not found" });

    const [match] = await db
      .select()
      .from(schema.matches)
      .where(and(eq(schema.matches.jobId, job.id), eq(schema.matches.userId, context.user.id)))
      .limit(1);
    const [application] = await db
      .select()
      .from(schema.applications)
      .where(and(eq(schema.applications.jobId, job.id), eq(schema.applications.userId, context.user.id)))
      .limit(1);

    return { job, match: match ?? null, application: application ?? null };
  }),

  /** Pull today's listings from every board now, instead of waiting for the daily run. */
  refresh: authed.handler(async () => {
    const result = await runScrape();
    return result;
  }),

  /**
   * Score the most plausible unscored jobs against the user's profile.
   * Lexical pre-filter first, then the model in batches — keeps a refresh to seconds, not minutes.
   */
  rank: authed
    .input(z.object({ limit: z.number().min(6).max(48).default(24) }))
    .handler(async ({ input, context }) => {
      const profile = await userProfile(context.user.id);
      if (!profile) throw new ORPCError("BAD_REQUEST", { message: "Finish onboarding first." });
      if (!profile.resumeText?.trim() && !profile.aiSummary) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Add your resume or notes and run the profile analysis first.",
        });
      }

      const already = await db
        .select({ jobId: schema.matches.jobId })
        .from(schema.matches)
        .where(eq(schema.matches.userId, context.user.id));
      const scoredIds = new Set(already.map((m) => m.jobId));

      const pool = await db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.active, true))
        .orderBy(desc(schema.jobs.postedAt))
        .limit(1200);

      const titles = profile.desiredTitles?.length
        ? profile.desiredTitles
        : (profile.aiSuggestedTitles ?? []);
      const industries = profile.industries ?? [];
      const remotePref = profile.remotePreference;

      const candidates = pool
        .filter((j) => !scoredIds.has(j.id))
        .filter((j) => (remotePref === "remote" ? j.isRemote : true))
        .map((j) => ({ job: j, rel: relevance(j, titles, industries) }))
        .filter((c) => c.rel > 0)
        .sort((a, b) => b.rel - a.rel || (b.job.postedAt?.getTime() ?? 0) - (a.job.postedAt?.getTime() ?? 0))
        .slice(0, input.limit)
        .map((c) => c.job);

      if (!candidates.length) return { scored: 0, message: "No new matching listings to score right now." };

      const blob = profileContext(profile);
      const batches: (typeof candidates)[] = [];
      for (let i = 0; i < candidates.length; i += 12) batches.push(candidates.slice(i, i + 12));

      const results = (
        await Promise.all(
          batches.map((batch) =>
            scoreJobs(
              blob,
              batch.map((j) => ({
                id: j.id,
                title: j.title,
                company: j.company,
                location: j.location,
                isRemote: j.isRemote,
                team: j.team,
                description: j.description,
              })),
            ).catch((err) => {
              console.warn("[rank] batch failed:", (err as Error).message);
              return [];
            }),
          ),
        )
      ).flat();

      for (const r of results) {
        await db
          .insert(schema.matches)
          .values({
            userId: context.user.id,
            jobId: r.jobId,
            score: r.score,
            reasoning: r.reasoning,
            strengths: r.strengths,
            gaps: r.gaps,
          })
          .onConflictDoUpdate({
            target: [schema.matches.userId, schema.matches.jobId],
            set: { score: r.score, reasoning: r.reasoning, strengths: r.strengths, gaps: r.gaps },
          });
      }

      const top = results.sort((a, b) => b.score - a.score).slice(0, 3);
      const topJobs = top.length ? await db.select().from(schema.jobs).where(inArray(schema.jobs.id, top.map((t) => t.jobId))) : [];

      return {
        scored: results.length,
        top: top.map((t) => ({
          jobId: t.jobId,
          score: t.score,
          title: topJobs.find((j) => j.id === t.jobId)?.title ?? "",
          company: topJobs.find((j) => j.id === t.jobId)?.company ?? "",
        })),
      };
    }),
};
