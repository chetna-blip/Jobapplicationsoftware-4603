import { z } from "zod";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { s3, signedGetUrl } from "../lib/s3";
import { resumeTextFromKey } from "../lib/resume";
import { fetchPageText } from "../lib/html";
import { extractProfile } from "../agent/profile";

async function ensureProfile(userId: string, fallback: { name?: string | null; email?: string | null }) {
  const [existing] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(schema.profiles)
    .values({
      userId,
      fullName: fallback.name ?? null,
      email: fallback.email ?? null,
    })
    .returning();
  return created!;
}

const updateInput = z.object({
  fullName: z.string().max(120).nullish(),
  email: z.string().max(200).nullish(),
  phone: z.string().max(60).nullish(),
  location: z.string().max(160).nullish(),
  headline: z.string().max(200).nullish(),
  linkedinUrl: z.string().max(400).nullish(),
  portfolioUrl: z.string().max(400).nullish(),
  githubUrl: z.string().max(400).nullish(),
  otherLinks: z.array(z.string().max(400)).max(8).nullish(),
  desiredTitles: z.array(z.string().max(120)).max(12).nullish(),
  desiredLocations: z.array(z.string().max(120)).max(12).nullish(),
  remotePreference: z.enum(["remote", "hybrid", "onsite", "any"]).nullish(),
  industries: z.array(z.string().max(80)).max(12).nullish(),
  seniority: z.string().max(40).nullish(),
  yearsExperience: z.number().int().min(0).max(60).nullish(),
  workAuthorization: z.string().max(200).nullish(),
  requiresSponsorship: z.boolean().nullish(),
  salaryExpectation: z.string().max(120).nullish(),
  noticePeriod: z.string().max(120).nullish(),
  willingToRelocate: z.boolean().nullish(),
  pronouns: z.string().max(40).nullish(),
  extraNotes: z.string().max(4000).nullish(),
  autoApplyEnabled: z.boolean().nullish(),
  onboardingComplete: z.boolean().nullish(),
});

export const profile = {
  /** The signed-in user's profile, created on first read. */
  get: authed.handler(async ({ context }) => {
    const row = await ensureProfile(context.user.id, {
      name: context.user.name,
      email: context.user.email,
    });
    const resumeUrl = row.resumeKey ? await signedGetUrl(row.resumeKey, 3600) : null;
    return { ...row, resumeUrl, hasResumeText: !!row.resumeText?.trim() };
  }),

  update: authed.input(updateInput).handler(async ({ input, context }) => {
    await ensureProfile(context.user.id, { name: context.user.name, email: context.user.email });
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    const [row] = await db
      .update(schema.profiles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.profiles.userId, context.user.id))
      .returning();
    return row!;
  }),

  /** Presigned PUT for the resume — the file goes straight from browser to storage. */
  presignResume: authed
    .input(z.object({ filename: z.string().min(1).max(200), contentType: z.string().max(200) }))
    .handler(async ({ input, context }) => {
      const safe = input.filename.replace(/[^\w.\-]+/g, "_").slice(-120);
      const key = `resumes/${context.user.id}/${Date.now()}-${safe}`;
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          ContentType: input.contentType || "application/octet-stream",
        }),
        { expiresIn: 600 },
      );
      return { url, key };
    }),

  /** After upload: parse the file to text and store it. */
  attachResume: authed
    .input(z.object({ key: z.string().min(1), filename: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      await ensureProfile(context.user.id, { name: context.user.name, email: context.user.email });
      let text = "";
      try {
        text = await resumeTextFromKey(input.key, input.filename);
      } catch (err) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Could not read that file: ${(err as Error).message}. A PDF or plain-text resume works best.`,
        });
      }
      if (text.trim().length < 80) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "That file had almost no readable text — it may be a scanned image. Upload a text-based PDF, or paste your background into the notes field instead.",
        });
      }
      const [row] = await db
        .update(schema.profiles)
        .set({
          resumeKey: input.key,
          resumeFilename: input.filename,
          resumeText: text,
          updatedAt: new Date(),
        })
        .where(eq(schema.profiles.userId, context.user.id))
        .returning();
      return { ok: true, characters: text.length, profile: row! };
    }),

  /**
   * Read the resume + public links and derive the structured profile the AI applies with.
   * Also suggests job titles, which onboarding offers as one-tap targets.
   */
  analyze: authed.handler(async ({ context }) => {
    const row = await ensureProfile(context.user.id, {
      name: context.user.name,
      email: context.user.email,
    });
    if (!row.resumeText?.trim() && !row.linkedinUrl && !row.portfolioUrl && !row.githubUrl && !row.extraNotes) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Add a resume, a link, or some notes first — there's nothing to read yet.",
      });
    }

    const urls = [row.portfolioUrl, row.githubUrl, ...(row.otherLinks ?? [])].filter(
      (u): u is string => !!u && /^https?:\/\//.test(u),
    );
    const linkTexts = await Promise.all(
      urls.slice(0, 4).map(async (url) => ({ url, text: await fetchPageText(url, 5000) })),
    );

    const result = await extractProfile({
      resumeText: row.resumeText,
      linkTexts,
      notes: row.extraNotes,
    });

    const [updated] = await db
      .update(schema.profiles)
      .set({
        fullName: row.fullName ?? result.fullName,
        email: row.email ?? result.email,
        phone: row.phone ?? result.phone,
        location: row.location ?? result.location,
        headline: row.headline ?? result.headline,
        yearsExperience: row.yearsExperience ?? result.yearsExperience,
        seniority: row.seniority ?? result.seniority,
        aiSummary: result.summary,
        aiSkills: result.skills,
        aiSuggestedTitles: result.suggestedTitles,
        industries: row.industries?.length ? row.industries : result.suggestedIndustries,
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, context.user.id))
      .returning();

    return { profile: updated!, suggestedTitles: result.suggestedTitles };
  }),
};
