import { generateObject } from "ai";
import dedent from "dedent";
import z from "zod";
import { gateway, MODELS } from "./gateway";
import { truncate } from "../lib/html";

const extraction = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  headline: z.string().describe("One-line professional headline, e.g. 'Senior backend engineer, fintech'"),
  summary: z
    .string()
    .describe("3-5 sentence factual summary of the candidate: domains, seniority, notable results"),
  skills: z.array(z.string()).describe("12-25 concrete skills, tools and domains pulled from the material"),
  suggestedTitles: z
    .array(z.string())
    .describe("5-8 job titles this person is genuinely a strong candidate for, most likely first"),
  suggestedIndustries: z.array(z.string()).describe("3-6 industries that fit this background"),
  yearsExperience: z.number().nullable(),
  seniority: z
    .enum(["intern", "junior", "mid", "senior", "staff", "lead", "manager", "director", "executive"])
    .nullable(),
});

export type ProfileExtraction = z.infer<typeof extraction>;

/** Turn raw resume text + scraped link content into a structured profile. */
export async function extractProfile(input: {
  resumeText?: string | null;
  linkTexts?: { url: string; text: string }[];
  notes?: string | null;
}): Promise<ProfileExtraction> {
  const links = (input.linkTexts ?? [])
    .filter((l) => l.text.trim().length > 60)
    .map((l) => `--- ${l.url} ---\n${truncate(l.text, 4000)}`)
    .join("\n\n");

  const { object } = await generateObject({
    model: gateway(MODELS.fast),
    schema: extraction,
    system: dedent`
      You extract a hiring profile from a candidate's own material.
      Only use facts present in the material — never invent employers, dates, degrees or numbers.
      If something is absent, return null (or omit it from arrays).
    `,
    prompt: dedent`
      RESUME TEXT:
      ${truncate(input.resumeText ?? "(none provided)", 18000)}

      LINKED PAGES:
      ${links || "(none)"}

      EXTRA NOTES FROM THE CANDIDATE:
      ${input.notes ?? "(none)"}
    `,
  });

  return object;
}

/** Compact profile blob used as context for scoring and application writing. */
export function profileContext(p: {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  pronouns?: string | null;
  headline?: string | null;
  location?: string | null;
  aiSummary?: string | null;
  aiSkills?: string[] | null;
  desiredTitles?: string[] | null;
  desiredLocations?: string[] | null;
  remotePreference?: string | null;
  industries?: string[] | null;
  seniority?: string | null;
  yearsExperience?: number | null;
  workAuthorization?: string | null;
  requiresSponsorship?: boolean | null;
  salaryExpectation?: string | null;
  noticePeriod?: string | null;
  willingToRelocate?: boolean | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  githubUrl?: string | null;
  extraNotes?: string | null;
  resumeText?: string | null;
}) {
  return dedent`
    Name: ${p.fullName ?? "—"}
    Email: ${p.email ?? "—"} | Phone: ${p.phone ?? "—"} | Pronouns: ${p.pronouns ?? "—"}
    Headline: ${p.headline ?? "—"}
    Based in: ${p.location ?? "—"}
    Experience: ${p.yearsExperience ?? "—"} years, seniority ${p.seniority ?? "—"}
    Summary: ${p.aiSummary ?? "—"}
    Skills: ${(p.aiSkills ?? []).join(", ") || "—"}
    Target titles: ${(p.desiredTitles ?? []).join(", ") || "—"}
    Target locations: ${(p.desiredLocations ?? []).join(", ") || "—"} (remote preference: ${p.remotePreference ?? "any"})
    Target industries: ${(p.industries ?? []).join(", ") || "—"}
    Work authorization: ${p.workAuthorization ?? "—"} | needs sponsorship: ${
      p.requiresSponsorship == null ? "—" : p.requiresSponsorship ? "yes" : "no"
    }
    Salary expectation: ${p.salaryExpectation ?? "—"} | Notice period: ${p.noticePeriod ?? "—"} | Open to relocation: ${
      p.willingToRelocate == null ? "—" : p.willingToRelocate ? "yes" : "no"
    }
    Links: LinkedIn ${p.linkedinUrl ?? "—"} | Portfolio ${p.portfolioUrl ?? "—"} | GitHub ${p.githubUrl ?? "—"}
    Notes from candidate: ${p.extraNotes ?? "—"}

    RESUME:
    ${truncate(p.resumeText ?? "(no resume text)", 9000)}
  `;
}
