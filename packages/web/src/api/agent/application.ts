import { generateObject } from "ai";
import dedent from "dedent";
import z from "zod";
import { gateway, MODELS } from "./gateway";
import { truncate } from "../lib/html";

export interface ApplicationQuestion {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

const draftSchema = z.object({
  coverLetter: z
    .string()
    .describe("180-260 words, first person, specific, no greeting fluff, no invented facts"),
  answers: z.array(
    z.object({
      name: z.string().describe("The field name given in the question list, copied exactly"),
      label: z.string(),
      answer: z
        .string()
        .describe(
          "The value to enter. For option questions, return EXACTLY one of the provided options verbatim.",
        ),
    }),
  ),
});

export type ApplicationDraft = z.infer<typeof draftSchema>;

/**
 * Write a tailored cover letter and answer the posting's real screening questions
 * using only facts from the candidate's profile.
 */
export async function draftApplication(args: {
  profileBlob: string;
  job: { title: string; company: string; location: string | null; description: string | null };
  questions: ApplicationQuestion[];
}): Promise<ApplicationDraft> {
  const answerable = args.questions.filter(
    (q) => !["input_file"].includes(q.type) && !/^(first_name|last_name|email|phone|resume)$/.test(q.name),
  );

  const questionList = answerable.length
    ? answerable
        .map(
          (q) =>
            `- name: ${q.name} | required: ${q.required} | type: ${q.type} | question: ${q.label}` +
            (q.options?.length ? `\n  options (choose verbatim): ${q.options.join(" | ")}` : ""),
        )
        .join("\n")
    : "(this board exposes no custom questions — return an empty answers array)";

  const { object } = await generateObject({
    model: gateway(MODELS.writer),
    schema: draftSchema,
    system: dedent`
      You fill in job applications on the candidate's behalf. Rules:
      - Never invent employers, titles, dates, degrees, numbers or authorizations. Use only the profile.
      - If a question asks something the profile does not answer, give the most reasonable neutral answer
        consistent with the profile (e.g. "Open to discussing" for salary if no expectation is stated).
      - Option questions: return exactly one of the given options, character for character.
      - Never output a placeholder like "N/A", "<UNKNOWN>", "TBD" or empty brackets. If the profile
        genuinely does not cover an optional question, omit that question from the answers array
        entirely rather than inventing filler.
      - Yes/no questions about work authorization and sponsorship must follow the profile's stated facts.
      - Cover letter: concrete, plain language, specific to this role and company. No "I am writing to
        express my interest", no flattery, no em-dash-heavy AI cadence, no invented enthusiasm for
        products the candidate has not used.
    `,
    prompt: dedent`
      CANDIDATE
      ${args.profileBlob}

      ROLE
      ${args.job.title} @ ${args.job.company} (${args.job.location ?? "location unspecified"})
      ${truncate(args.job.description ?? "(no description available)", 8000)}

      QUESTIONS TO ANSWER
      ${questionList}
    `,
  });

  return object;
}
