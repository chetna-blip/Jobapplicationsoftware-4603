import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { hydrateJob } from "../lib/scrape";
import { profileContext } from "../agent/profile";
import { draftApplication } from "../agent/application";
import { bookmarklet, consoleSnippet, type AutofillField } from "../lib/autofill";
import { signedGetUrl } from "../lib/s3";

const STATUSES = [
  "drafted",
  "needs_review",
  "submitted_manually",
  "failed",
  "skipped",
] as const;

async function requireProfile(userId: string) {
  const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
  if (!row) throw new ORPCError("BAD_REQUEST", { message: "Finish onboarding first." });
  return row;
}

/** Identity fields every ATS form asks for, plus whatever the posting adds. */
function baseFields(profile: typeof schema.profiles.$inferSelect): AutofillField[] {
  const full = (profile.fullName ?? "").trim();
  const [first, ...rest] = full.split(/\s+/);
  const out: AutofillField[] = [];
  if (full) {
    // Lever asks for one "Full name", Greenhouse for first + last. Send all three as aliases: a
    // form has one shape or the other, never both, so the unused ones are expected to go unmatched.
    out.push({ name: "name", label: "Full name", value: full, kind: "text", alias: true });
    out.push({ name: "first_name", label: "First name", value: first ?? full, kind: "text", alias: true });
    out.push({
      name: "last_name",
      label: "Last name",
      value: rest.join(" ") || first || full,
      kind: "text",
      alias: true,
    });
  }
  if (profile.email) out.push({ name: "email", label: "Email", value: profile.email, kind: "text" });
  if (profile.phone) out.push({ name: "phone", label: "Phone", value: profile.phone, kind: "text" });
  if (profile.location)
    out.push({ name: "location", label: "Location (city)", value: profile.location, kind: "text" });
  if (profile.linkedinUrl)
    out.push({ name: "urls[LinkedIn]", label: "LinkedIn profile", value: profile.linkedinUrl, kind: "text" });
  if (profile.githubUrl)
    out.push({ name: "urls[GitHub]", label: "GitHub", value: profile.githubUrl, kind: "text" });
  if (profile.portfolioUrl)
    out.push({
      name: "urls[Portfolio]",
      label: "Website or portfolio",
      value: profile.portfolioUrl,
      kind: "text",
    });
  return out;
}

export const applications = {
  /** The tracker: every application this user has, newest first. */
  list: authed
    .input(z.object({ status: z.enum(["all", ...STATUSES]).default("all") }).optional())
    .handler(async ({ input, context }) => {
      const filters = [eq(schema.applications.userId, context.user.id)];
      if (input?.status && input.status !== "all") filters.push(eq(schema.applications.status, input.status));
      const rows = await db
        .select({ application: schema.applications, job: schema.jobs, score: schema.matches.score })
        .from(schema.applications)
        .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
        .leftJoin(
          schema.matches,
          and(eq(schema.matches.jobId, schema.jobs.id), eq(schema.matches.userId, context.user.id)),
        )
        .where(and(...filters))
        .orderBy(desc(schema.applications.updatedAt));
      return rows.map((r) => ({ ...r.application, job: r.job, score: r.score }));
    }),

  get: authed.input(z.object({ jobId: z.number() })).handler(async ({ input, context }) => {
    const [row] = await db
      .select()
      .from(schema.applications)
      .where(
        and(eq(schema.applications.userId, context.user.id), eq(schema.applications.jobId, input.jobId)),
      )
      .limit(1);
    return row ?? null;
  }),

  /**
   * Write the application: a tailored cover letter plus an answer to every real screening
   * question the posting exposes. Idempotent unless `force` is set.
   */
  draft: authed
    .input(z.object({ jobId: z.number(), force: z.boolean().default(false) }))
    .handler(async ({ input, context }) => {
      const profile = await requireProfile(context.user.id);
      if (!profile.resumeText?.trim() && !profile.aiSummary) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Add your resume (or notes) and run the profile analysis before drafting.",
        });
      }

      const [existing] = await db
        .select()
        .from(schema.applications)
        .where(
          and(eq(schema.applications.userId, context.user.id), eq(schema.applications.jobId, input.jobId)),
        )
        .limit(1);
      if (existing?.coverLetter && !input.force) return existing;

      const job = await hydrateJob(input.jobId);
      if (!job) throw new ORPCError("NOT_FOUND", { message: "Job not found" });

      const questions = job.questions ?? [];
      let draft;
      try {
        draft = await draftApplication({
          profileBlob: profileContext(profile),
          job: { title: job.title, company: job.company, location: job.location, description: job.description },
          questions,
        });
      } catch (err) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: `Drafting failed: ${(err as Error).message}`,
        });
      }

      const values = {
        userId: context.user.id,
        jobId: job.id,
        status: "needs_review" as const,
        method: "manual" as const,
        coverLetter: draft.coverLetter,
        answers: draft.answers.map((a) => ({ label: a.label, answer: a.answer, name: a.name })),
        submissionLog:
          `Drafted ${new Date().toISOString()} — ${draft.answers.length} screening answer(s) from ` +
          `${questions.length} question(s) published by ${job.source}.`,
        error: null,
        updatedAt: new Date(),
      };

      const [row] = await db
        .insert(schema.applications)
        .values(values)
        .onConflictDoUpdate({
          target: [schema.applications.userId, schema.applications.jobId],
          set: values,
        })
        .returning();
      return row!;
    }),

  /**
   * Everything needed to fill the real form: the field/value pairs, a one-click bookmarklet that
   * writes them into the live apply page, and a signed link to the resume file.
   *
   * Silent server-side submission is impossible on these boards — Lever's public apply endpoint
   * answers `403 You need an API key`, and Greenhouse's application endpoint needs the employer's
   * private key. So the last step stays in the candidate's own browser, one click away.
   */
  autofill: authed.input(z.object({ jobId: z.number() })).handler(async ({ input, context }) => {
    const profile = await requireProfile(context.user.id);
    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, input.jobId)).limit(1);
    if (!job) throw new ORPCError("NOT_FOUND", { message: "Job not found" });

    const [application] = await db
      .select()
      .from(schema.applications)
      .where(and(eq(schema.applications.userId, context.user.id), eq(schema.applications.jobId, job.id)))
      .limit(1);
    if (!application?.coverLetter) {
      throw new ORPCError("BAD_REQUEST", { message: "Draft the application first." });
    }

    const fields: AutofillField[] = [
      ...baseFields(profile),
      ...(application.answers ?? []).map((a) => ({
        name: (a as { name?: string }).name,
        label: a.label,
        value: a.answer,
        kind: (a.answer.length > 120 ? "textarea" : "text") as AutofillField["kind"],
      })),
      // Alias because the bookmarklet reports an unplaced letter itself (and puts it on the
      // clipboard), which is more useful than a bare "left for you" line.
      {
        name: "cover_letter_text",
        label: "Cover letter",
        value: application.coverLetter,
        kind: "textarea",
        alias: true,
      },
      // Only some Lever postings carry this box; when it is absent the letter above already
      // covers it, so its absence is not something to bother the candidate about.
      {
        name: "comments",
        label: "Additional information",
        value: application.coverLetter,
        kind: "textarea",
        alias: true,
      },
    ];

    const payload = { company: job.company, title: job.title, applyUrl: job.applyUrl, fields };
    return {
      applyUrl: job.applyUrl,
      resumeUrl: profile.resumeKey ? await signedGetUrl(profile.resumeKey, 3600) : null,
      resumeFilename: profile.resumeFilename,
      fields,
      bookmarklet: bookmarklet(payload),
      snippet: consoleSnippet(payload),
    };
  }),

  /** Move an application through the tracker, and keep user edits to the letter/answers. */
  update: authed
    .input(
      z.object({
        jobId: z.number(),
        status: z.enum(STATUSES).optional(),
        coverLetter: z.string().max(12000).optional(),
        answers: z
          .array(z.object({ name: z.string().optional(), label: z.string(), answer: z.string().max(6000) }))
          .optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const [existing] = await db
        .select()
        .from(schema.applications)
        .where(
          and(eq(schema.applications.userId, context.user.id), eq(schema.applications.jobId, input.jobId)),
        )
        .limit(1);
      if (!existing) throw new ORPCError("NOT_FOUND", { message: "No application for that job yet." });

      const [row] = await db
        .update(schema.applications)
        .set({
          ...(input.status ? { status: input.status } : {}),
          ...(input.coverLetter !== undefined ? { coverLetter: input.coverLetter } : {}),
          ...(input.answers ? { answers: input.answers } : {}),
          ...(input.status === "submitted_manually" ? { submittedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.applications.id, existing.id))
        .returning();
      return row!;
    }),

  /** Draft the top-scoring jobs the user hasn't touched yet, in one go. */
  draftBatch: authed
    .input(z.object({ jobIds: z.array(z.number()).min(1).max(8) }))
    .handler(async ({ input, context }) => {
      const profile = await requireProfile(context.user.id);
      const blob = profileContext(profile);
      const results: { jobId: number; ok: boolean; error?: string }[] = [];

      for (const jobId of input.jobIds) {
        try {
          const job = await hydrateJob(jobId);
          if (!job) throw new Error("Job not found");
          const draft = await draftApplication({
            profileBlob: blob,
            job: {
              title: job.title,
              company: job.company,
              location: job.location,
              description: job.description,
            },
            questions: job.questions ?? [],
          });
          const values = {
            userId: context.user.id,
            jobId,
            status: "needs_review" as const,
            method: "manual" as const,
            coverLetter: draft.coverLetter,
            answers: draft.answers.map((a) => ({ label: a.label, answer: a.answer, name: a.name })),
            submissionLog: `Drafted in batch ${new Date().toISOString()}`,
            error: null,
            updatedAt: new Date(),
          };
          await db
            .insert(schema.applications)
            .values(values)
            .onConflictDoUpdate({
              target: [schema.applications.userId, schema.applications.jobId],
              set: values,
            });
          results.push({ jobId, ok: true });
        } catch (err) {
          results.push({ jobId, ok: false, error: (err as Error).message });
        }
      }
      return { results, drafted: results.filter((r) => r.ok).length };
    }),
};
