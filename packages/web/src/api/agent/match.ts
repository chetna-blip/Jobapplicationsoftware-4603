import { generateObject } from "ai";
import dedent from "dedent";
import z from "zod";
import { gateway, MODELS } from "./gateway";
import { truncate } from "../lib/html";

const scoreSchema = z.object({
  results: z.array(
    z.object({
      jobId: z.number(),
      score: z.number().min(0).max(100),
      reasoning: z.string().describe("1-2 sentences, specific to this candidate and this role"),
      strengths: z.array(z.string()).max(4),
      gaps: z.array(z.string()).max(3),
    }),
  ),
});

export interface JobForScoring {
  id: number;
  title: string;
  company: string;
  location: string | null;
  isRemote: boolean;
  team: string | null;
  description: string | null;
}

/** Score a batch of jobs (≤12 at a time) against the profile. */
export async function scoreJobs(profileBlob: string, jobs: JobForScoring[]) {
  if (!jobs.length) return [];

  const jobBlocks = jobs
    .map(
      (j) => dedent`
        [jobId ${j.id}] ${j.title} @ ${j.company}
        Location: ${j.location ?? "—"}${j.isRemote ? " (remote)" : ""} | Team: ${j.team ?? "—"}
        ${truncate(j.description ?? "(no description available — judge from title, team and company)", 2200)}
      `,
    )
    .join("\n\n———\n\n");

  const { object } = await generateObject({
    model: gateway(MODELS.fast),
    schema: scoreSchema,
    system: dedent`
      You are a blunt recruiter scoring fit between one candidate and several job postings.
      Score 0-100 on real hireability, not enthusiasm:
        85-100 = strong match, would likely get a screen
        70-84  = plausible, worth applying
        50-69  = stretch or partial overlap
        0-49   = wrong field, wrong seniority, or hard blocker (location/authorization)
      Penalise seniority mismatch, wrong discipline and location/work-authorization blockers hard.
      Return one result per jobId given, no extras.
    `,
    prompt: dedent`
      CANDIDATE
      ${profileBlob}

      JOBS
      ${jobBlocks}
    `,
  });

  return object.results.filter((r) => jobs.some((j) => j.id === r.jobId));
}
