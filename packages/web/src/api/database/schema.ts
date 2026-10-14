import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";

/** One profile per user — everything needed to answer an application. */
export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique(),

  // identity
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  location: text("location"),
  headline: text("headline"),

  // links
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  githubUrl: text("github_url"),
  otherLinks: text("other_links", { mode: "json" }).$type<string[]>(),

  // resume
  resumeKey: text("resume_key"),
  resumeFilename: text("resume_filename"),
  resumeText: text("resume_text"),

  // targets (onboarding answers)
  desiredTitles: text("desired_titles", { mode: "json" }).$type<string[]>(),
  desiredLocations: text("desired_locations", { mode: "json" }).$type<string[]>(),
  remotePreference: text("remote_preference"), // remote | hybrid | onsite | any
  industries: text("industries", { mode: "json" }).$type<string[]>(),
  seniority: text("seniority"),
  yearsExperience: integer("years_experience"),

  // application facts
  workAuthorization: text("work_authorization"),
  requiresSponsorship: integer("requires_sponsorship", { mode: "boolean" }),
  salaryExpectation: text("salary_expectation"),
  noticePeriod: text("notice_period"),
  willingToRelocate: integer("willing_to_relocate", { mode: "boolean" }),
  pronouns: text("pronouns"),
  extraNotes: text("extra_notes"),

  // AI-derived
  aiSummary: text("ai_summary"),
  aiSkills: text("ai_skills", { mode: "json" }).$type<string[]>(),
  aiSuggestedTitles: text("ai_suggested_titles", { mode: "json" }).$type<string[]>(),

  onboardingComplete: integer("onboarding_complete", { mode: "boolean" }).notNull().default(false),
  autoApplyEnabled: integer("auto_apply_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Aggregated job listings from public ATS boards. */
export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(), // greenhouse | lever
    boardToken: text("board_token").notNull(),
    externalId: text("external_id").notNull(),
    company: text("company").notNull(),
    companyCategory: text("company_category"),
    title: text("title").notNull(),
    location: text("location"),
    isRemote: integer("is_remote", { mode: "boolean" }).notNull().default(false),
    team: text("team"),
    commitment: text("commitment"),
    url: text("url").notNull(),
    applyUrl: text("apply_url").notNull(),
    description: text("description"),
    /** Posting-specific application questions, when the board exposes them. */
    questions: text("questions", { mode: "json" }).$type<
      { name: string; label: string; type: string; required: boolean; options?: string[] }[]
    >(),
    postedAt: integer("posted_at", { mode: "timestamp" }),
    autoApplySupported: integer("auto_apply_supported", { mode: "boolean" }).notNull().default(false),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    uniqueIndex("jobs_source_external_idx").on(t.source, t.boardToken, t.externalId),
    index("jobs_active_idx").on(t.active),
  ],
);

/** Per-user AI match score for a job. */
export const matches = sqliteTable(
  "matches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    jobId: integer("job_id").notNull(),
    score: real("score").notNull(),
    reasoning: text("reasoning"),
    strengths: text("strengths", { mode: "json" }).$type<string[]>(),
    gaps: text("gaps", { mode: "json" }).$type<string[]>(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("matches_user_job_idx").on(t.userId, t.jobId),
    index("matches_user_score_idx").on(t.userId, t.score),
  ],
);

/**
 * An application attempt.
 * status: drafted | auto_submitted | needs_review | submitted_manually | failed | skipped
 * method: auto_api | manual
 */
export const applications = sqliteTable(
  "applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    jobId: integer("job_id").notNull(),
    status: text("status").notNull().default("drafted"),
    method: text("method").notNull().default("manual"),
    coverLetter: text("cover_letter"),
    answers: text("answers", { mode: "json" }).$type<
      { label: string; answer: string; name?: string }[]
    >(),
    submissionLog: text("submission_log"),
    error: text("error"),
    submittedAt: integer("submitted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("applications_user_job_idx").on(t.userId, t.jobId)],
);

/** Bookkeeping for the daily scrape. */
export const scrapeRuns = sqliteTable("scrape_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  boardsOk: integer("boards_ok").notNull().default(0),
  boardsFailed: integer("boards_failed").notNull().default(0),
  jobsInserted: integer("jobs_inserted").notNull().default(0),
  jobsUpdated: integer("jobs_updated").notNull().default(0),
  status: text("status").notNull().default("running"),
  error: text("error"),
});
