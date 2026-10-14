import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { BOARDS, MAX_JOBS_PER_BOARD, type Board } from "./sources";
import { htmlToText, truncate } from "./html";

export interface ScrapedJob {
  source: string;
  boardToken: string;
  externalId: string;
  company: string;
  companyCategory: string;
  title: string;
  location: string | null;
  isRemote: boolean;
  team: string | null;
  commitment: string | null;
  url: string;
  applyUrl: string;
  description: string | null;
  postedAt: Date | null;
  autoApplySupported: boolean;
}

const REMOTE_RE = /\bremote\b|\banywhere\b|work from home|distributed/i;

function isRemote(...parts: (string | null | undefined)[]) {
  return parts.some((p) => !!p && REMOTE_RE.test(p));
}

async function fetchJson<T>(url: string, timeoutMs = 20000): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ApplyCopilot/1.0 (+job aggregator)" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string } | null;
  departments?: { name?: string }[];
  offices?: { name?: string }[];
  content?: string;
}

async function scrapeGreenhouse(board: Board): Promise<ScrapedJob[]> {
  const data = await fetchJson<{ jobs: GreenhouseJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs`,
  );
  const jobs = [...(data.jobs ?? [])]
    .sort((a, b) => toTime(b.first_published ?? b.updated_at) - toTime(a.first_published ?? a.updated_at))
    .slice(0, MAX_JOBS_PER_BOARD);

  return jobs.map((j) => {
    const location = j.location?.name ?? j.offices?.[0]?.name ?? null;
    const team = j.departments?.[0]?.name ?? null;
    return {
      source: "greenhouse",
      boardToken: board.token,
      externalId: String(j.id),
      company: board.company,
      companyCategory: board.category,
      title: j.title.trim(),
      location,
      isRemote: isRemote(location, j.title),
      team,
      commitment: null,
      url: `https://job-boards.greenhouse.io/${board.token}/jobs/${j.id}`,
      // Greenhouse's own posting URL 302s to the company's careers site for employers that host
      // their own page (Stripe, for one), where the real form lives in a *cross-origin* iframe —
      // a bookmarklet in the top frame cannot reach into it. The `embed/job_app` URL serves that
      // same form standalone at the top level, so autofill works. Verified live.
      applyUrl: `https://job-boards.greenhouse.io/embed/job_app?for=${board.token}&token=${j.id}`,
      description: null, // hydrated on demand (per-job endpoint carries content + questions)
      postedAt: j.first_published ? new Date(j.first_published) : j.updated_at ? new Date(j.updated_at) : null,
      autoApplySupported: true,
    };
  });
}

interface LeverPosting {
  id: string;
  text: string;
  createdAt?: number;
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
    department?: string;
    allLocations?: string[];
  };
  workplaceType?: string;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
  hostedUrl: string;
  applyUrl: string;
}

async function scrapeLever(board: Board): Promise<ScrapedJob[]> {
  const data = await fetchJson<LeverPosting[]>(
    `https://api.lever.co/v0/postings/${board.token}?mode=json&limit=${MAX_JOBS_PER_BOARD}`,
  );
  return (data ?? []).slice(0, MAX_JOBS_PER_BOARD).map((p) => {
    const location = p.categories?.location ?? p.categories?.allLocations?.[0] ?? null;
    const lists = (p.lists ?? [])
      .map((l) => `${l.text}\n${htmlToText(l.content)}`)
      .join("\n\n");
    const body = [p.descriptionPlain ?? htmlToText(p.description), lists, p.additionalPlain]
      .filter(Boolean)
      .join("\n\n");
    return {
      source: "lever",
      boardToken: board.token,
      externalId: p.id,
      company: board.company,
      companyCategory: board.category,
      title: p.text.trim(),
      location,
      isRemote: p.workplaceType === "remote" || isRemote(location, p.text),
      team: p.categories?.team ?? p.categories?.department ?? null,
      commitment: p.categories?.commitment ?? null,
      url: p.hostedUrl,
      applyUrl: p.applyUrl ?? `${p.hostedUrl}/apply`,
      description: truncate(body, 12000) || null,
      postedAt: p.createdAt ? new Date(p.createdAt) : null,
      autoApplySupported: true,
    };
  });
}

function toTime(value?: string) {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

async function upsert(rows: ScrapedJob[]) {
  let inserted = 0;
  let updated = 0;
  const now = new Date();

  for (const row of rows) {
    const existing = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.source, row.source),
          eq(schema.jobs.boardToken, row.boardToken),
          eq(schema.jobs.externalId, row.externalId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(schema.jobs)
        .set({
          title: row.title,
          location: row.location,
          isRemote: row.isRemote,
          team: row.team,
          commitment: row.commitment,
          url: row.url,
          applyUrl: row.applyUrl,
          ...(row.description ? { description: row.description } : {}),
          lastSeenAt: now,
          active: true,
        })
        .where(eq(schema.jobs.id, existing[0].id));
      updated++;
    } else {
      await db.insert(schema.jobs).values({ ...row, firstSeenAt: now, lastSeenAt: now, active: true });
      inserted++;
    }
  }
  return { inserted, updated };
}

/** Scrape every configured board and upsert results. Safe to call concurrently-ish; cheap enough daily. */
export async function runScrape(opts: { boards?: Board[] } = {}) {
  const boards = opts.boards ?? BOARDS;
  const [run] = await db
    .insert(schema.scrapeRuns)
    .values({ startedAt: new Date(), status: "running" })
    .returning();

  let boardsOk = 0;
  let boardsFailed = 0;
  let jobsInserted = 0;
  let jobsUpdated = 0;
  const seenIds: { source: string; token: string; ids: string[] }[] = [];

  // modest concurrency keeps the whole sweep well under a minute
  const queue = [...boards];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const board = queue.shift();
      if (!board) return;
      try {
        const rows = board.source === "greenhouse" ? await scrapeGreenhouse(board) : await scrapeLever(board);
        const { inserted, updated } = await upsert(rows);
        jobsInserted += inserted;
        jobsUpdated += updated;
        seenIds.push({ source: board.source, token: board.token, ids: rows.map((r) => r.externalId) });
        boardsOk++;
      } catch (err) {
        boardsFailed++;
        console.warn(`[scrape] ${board.source}/${board.token} failed:`, (err as Error).message);
      }
    }
  });
  await Promise.all(workers);

  // Anything we didn't see on a board that responded is closed — mark inactive.
  for (const { source, token, ids } of seenIds) {
    if (!ids.length) continue;
    await db
      .update(schema.jobs)
      .set({ active: false })
      .where(
        and(
          eq(schema.jobs.source, source),
          eq(schema.jobs.boardToken, token),
          sql`${schema.jobs.externalId} not in (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );
  }

  await db
    .update(schema.scrapeRuns)
    .set({
      finishedAt: new Date(),
      status: "done",
      boardsOk,
      boardsFailed,
      jobsInserted,
      jobsUpdated,
    })
    .where(eq(schema.scrapeRuns.id, run!.id));

  return { boardsOk, boardsFailed, jobsInserted, jobsUpdated };
}

/**
 * Lever's public Postings API does NOT expose a posting's screening questions — the posting object
 * carries only lists/description content (verified live: its keys are additional, categories,
 * descriptionBody, lists, text, hostedUrl, applyUrl …). The real questions exist only in the
 * rendered apply page, as `<li class="application-question custom-question">` blocks whose inputs
 * are named cards[cardId][fieldN]. So scrape that page.
 *
 * Demographic blocks (eeo[...], surveysResponses[...]) are deliberately skipped: they are
 * voluntary personal data and the candidate should answer them, not an AI.
 */
async function leverQuestions(boardToken: string, externalId: string) {
  const res = await fetch(`https://jobs.lever.co/${boardToken}/${externalId}/apply`, {
    headers: { "User-Agent": "ApplyCopilot/1.0 (+job aggregator)" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`lever apply page → HTTP ${res.status}`);
  const html = await res.text();
  const form = html.slice(Math.max(0, html.search(/<form[^>]*application-form/)));

  const out: NonNullable<typeof schema.jobs.$inferSelect.questions> = [];
  for (const block of form.split(/<li class="application-question/).slice(1)) {
    const body = block.slice(0, 6000);
    const name = body.match(/name="(cards\[[^"]+\]\[field\d+\])"/)?.[1];
    if (!name) continue;
    const label = htmlToText(decodeEntities(body.match(/<div class="text">([\s\S]*?)<\/div>/)?.[1] ?? ""))
      .replace(/\s+/g, " ")
      .trim();
    if (!label) continue;

    const type = /<textarea/.test(body)
      ? "textarea"
      : /type="radio"/.test(body) || /<select/.test(body)
        ? "multi_value_single_select"
        : /type="checkbox"/.test(body)
          ? "multi_value_multi_select"
          : "short_text";
    const options = [...body.matchAll(/class="application-answer-alternative">([\s\S]*?)<\/span>/g)]
      .map((m) => htmlToText(decodeEntities(m[1]!)).trim())
      .filter(Boolean);

    out.push({
      name,
      label,
      type,
      required: /class="required"|required="required"/.test(body),
      ...(options.length ? { options } : {}),
    });
  }
  return out;
}

/** Pull the full description and the posting's real application questions for one job. */
export async function hydrateJob(jobId: number) {
  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
  if (!job) return null;
  if (job.description && job.questions) return job;

  try {
    if (job.source === "greenhouse") {
      const data = await fetchJson<{
        content?: string;
        questions?: {
          label: string;
          required: boolean;
          fields: { name: string; type: string; values?: { label: string; value: string | number }[] }[];
        }[];
      }>(`https://boards-api.greenhouse.io/v1/boards/${job.boardToken}/jobs/${job.externalId}?questions=true`);

      const description = truncate(htmlToText(decodeEntities(data.content ?? "")), 14000);
      const questions = (data.questions ?? [])
        .filter((q) => !!q.fields?.length)
        .map((q) => {
          const field = q.fields[0]!;
          return {
            name: field.name,
            label: q.label,
            type: field.type,
            required: q.required,
            options: field.values?.map((v) => String(v.label)),
          };
        });

      const [row] = await db
        .update(schema.jobs)
        .set({ description: description || job.description, questions })
        .where(eq(schema.jobs.id, job.id))
        .returning();
      return row ?? job;
    }

    const p = await fetchJson<LeverPosting>(
      `https://api.lever.co/v0/postings/${job.boardToken}/${job.externalId}`,
    );
    const lists = (p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
    const description = truncate(
      [p.descriptionPlain ?? htmlToText(p.description), lists, p.additionalPlain].filter(Boolean).join("\n\n"),
      14000,
    );
    // Questions come from the apply page, not the API. A failure there must not lose the
    // description we just fetched, so keep them independent.
    let questions = job.questions ?? [];
    try {
      questions = await leverQuestions(job.boardToken, job.externalId);
    } catch (err) {
      console.warn(`[hydrate] lever questions for ${jobId} failed:`, (err as Error).message);
    }

    const [row] = await db
      .update(schema.jobs)
      .set({ description: description || job.description, questions })
      .where(eq(schema.jobs.id, job.id))
      .returning();
    return row ?? job;
  } catch (err) {
    console.warn(`[hydrate] job ${jobId} failed:`, (err as Error).message);
    return job;
  }
}

function decodeEntities(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

/** True when the last completed scrape is older than `hours`. */
export async function needsScrape(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 3600 * 1000);
  const recent = await db
    .select({ id: schema.scrapeRuns.id })
    .from(schema.scrapeRuns)
    .where(and(eq(schema.scrapeRuns.status, "done"), gt(schema.scrapeRuns.startedAt, cutoff)))
    .limit(1);
  return recent.length === 0;
}

export async function deactivateStale(days = 30) {
  const cutoff = new Date(Date.now() - days * 86400 * 1000);
  await db.update(schema.jobs).set({ active: false }).where(lt(schema.jobs.lastSeenAt, cutoff));
}

export async function jobsByIds(ids: number[]) {
  if (!ids.length) return [];
  return db.select().from(schema.jobs).where(inArray(schema.jobs.id, ids));
}
