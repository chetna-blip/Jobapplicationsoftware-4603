import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Check, FileText, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAnalyzeProfile, useProfile, useUpdateProfile, useUploadResume } from "../queries/profile";
import { Choice, Field, Switch, TagInput } from "../components/form";
import { ErrorNote, Spinner } from "../components/bits";

const STEPS = ["Resume", "Links", "Targets", "Details"];

type Draft = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  extraNotes: string;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  otherLinks: string[];
  desiredTitles: string[];
  desiredLocations: string[];
  industries: string[];
  remotePreference: "remote" | "hybrid" | "onsite" | "any";
  yearsExperience: string;
  seniority: string;
  workAuthorization: string;
  requiresSponsorship: boolean;
  salaryExpectation: string;
  noticePeriod: string;
  willingToRelocate: boolean;
  pronouns: string;
};

const EMPTY: Draft = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  extraNotes: "",
  linkedinUrl: "",
  portfolioUrl: "",
  githubUrl: "",
  otherLinks: [],
  desiredTitles: [],
  desiredLocations: [],
  industries: [],
  remotePreference: "any",
  yearsExperience: "",
  seniority: "",
  workAuthorization: "",
  requiresSponsorship: false,
  salaryExpectation: "",
  noticePeriod: "",
  willingToRelocate: false,
  pronouns: "",
};

function Ticker({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
              i === step ? "text-primary" : i < step ? "text-foreground" : "text-muted-foreground/50",
            )}
          >
            {i < step ? <Check className="mb-0.5 inline size-3" /> : `${i + 1}/`}
            {label}
          </span>
          {i < STEPS.length - 1 && <span className="h-px w-5 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function Onboarding() {
  const [, navigate] = useLocation();
  const profile = useProfile();
  const update = useUpdateProfile();
  const upload = useUploadResume();
  const analyze = useAnalyzeProfile();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed the form from the stored profile once it arrives.
  useEffect(() => {
    const p = profile.data;
    if (!p || hydrated.current) return;
    hydrated.current = true;
    setDraft((d) => ({
      ...d,
      fullName: p.fullName ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      location: p.location ?? "",
      extraNotes: p.extraNotes ?? "",
      linkedinUrl: p.linkedinUrl ?? "",
      portfolioUrl: p.portfolioUrl ?? "",
      githubUrl: p.githubUrl ?? "",
      otherLinks: p.otherLinks ?? [],
      desiredTitles: p.desiredTitles ?? [],
      desiredLocations: p.desiredLocations ?? [],
      industries: p.industries ?? [],
      remotePreference: (p.remotePreference as Draft["remotePreference"]) ?? "any",
      yearsExperience: p.yearsExperience != null ? String(p.yearsExperience) : "",
      seniority: p.seniority ?? "",
      workAuthorization: p.workAuthorization ?? "",
      requiresSponsorship: !!p.requiresSponsorship,
      salaryExpectation: p.salaryExpectation ?? "",
      noticePeriod: p.noticePeriod ?? "",
      willingToRelocate: !!p.willingToRelocate,
      pronouns: p.pronouns ?? "",
    }));
  }, [profile.data]);

  // Titles the AI derived from the resume — offered as one-tap targets in step 3.
  const suggested = profile.data?.aiSuggestedTitles ?? [];
  const busy = update.isPending || analyze.isPending || upload.isPending;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  }

  async function save(patch: Parameters<typeof update.mutateAsync>[0]) {
    await update.mutateAsync(patch);
  }

  async function next() {
    setError(null);
    try {
      if (step === 0) {
        await save({
          fullName: draft.fullName || null,
          email: draft.email || null,
          phone: draft.phone || null,
          location: draft.location || null,
          extraNotes: draft.extraNotes || null,
        });
        setStep(1);
        return;
      }
      if (step === 1) {
        await save({
          linkedinUrl: draft.linkedinUrl || null,
          portfolioUrl: draft.portfolioUrl || null,
          githubUrl: draft.githubUrl || null,
          otherLinks: draft.otherLinks,
        });
        // Read the resume + links now so step 3 can suggest real titles.
        try {
          const res = await analyze.mutateAsync({});
          if (res.suggestedTitles?.length && !draft.desiredTitles.length) {
            set("desiredTitles", res.suggestedTitles.slice(0, 3));
          }
          // Pull anything the analyzer derived into fields the user hasn't filled yet,
          // so step 4 arrives pre-answered instead of blank.
          const p = res.profile;
          setDraft((d) => ({
            ...d,
            fullName: d.fullName || p.fullName || "",
            email: d.email || p.email || "",
            phone: d.phone || p.phone || "",
            location: d.location || p.location || "",
            seniority: d.seniority || p.seniority || "",
            yearsExperience:
              d.yearsExperience || (p.yearsExperience != null ? String(p.yearsExperience) : ""),
            industries: d.industries.length ? d.industries : (p.industries ?? []),
          }));
        } catch (e) {
          setError(
            `${e instanceof Error ? e.message : "Analysis failed"} — you can still set targets by hand.`,
          );
        }
        setStep(2);
        return;
      }
      if (step === 2) {
        if (!draft.desiredTitles.length) {
          setError("Add at least one job title you want — it's what the feed is scored against.");
          return;
        }
        await save({
          desiredTitles: draft.desiredTitles,
          desiredLocations: draft.desiredLocations,
          industries: draft.industries,
          remotePreference: draft.remotePreference,
        });
        setStep(3);
        return;
      }
      await save({
        yearsExperience: draft.yearsExperience ? Number(draft.yearsExperience) : null,
        seniority: draft.seniority || null,
        workAuthorization: draft.workAuthorization || null,
        requiresSponsorship: draft.requiresSponsorship,
        salaryExpectation: draft.salaryExpectation || null,
        noticePeriod: draft.noticePeriod || null,
        willingToRelocate: draft.willingToRelocate,
        pronouns: draft.pronouns || null,
        onboardingComplete: true,
      });
      navigate("/jobs");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong saving that.");
    }
  }

  const hasResume = !!profile.data?.hasResumeText;

  return (
    <div className="mx-auto w-full max-w-[560px] px-5 py-14 sm:py-20">
      <div className="rise">
        <Ticker step={step} />
        <h1 className="mt-6 text-[2rem]">
          {step === 0 && "Start with your resume"}
          {step === 1 && "Where else can you be read?"}
          {step === 2 && "What are you actually after?"}
          {step === 3 && "The questions every form asks"}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          {step === 0 &&
            "This is the source of truth for everything the AI writes. A text-based PDF works best."}
          {step === 1 &&
            "Links get read too — they sharpen the match scoring and get filled into application forms automatically."}
          {step === 2 && "Titles drive the feed. Everything else narrows it."}
          {step === 3 &&
            "Answered once here, filled in forever. Nothing here is shared anywhere until you submit an application yourself."}
        </p>
      </div>

      <div className="rise mt-9 space-y-5" style={{ "--d": "80ms" } as React.CSSProperties}>
        {step === 0 && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex w-full items-center gap-4 rounded-xl border border-dashed px-5 py-6 text-left transition-colors",
                hasResume
                  ? "border-primary/40 bg-primary/[0.06]"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2">
                {upload.isPending ? (
                  <Spinner className="text-primary" />
                ) : hasResume ? (
                  <FileText className="size-4 text-primary" />
                ) : (
                  <Upload className="size-4 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm text-foreground">
                  {upload.isPending
                    ? "Reading it…"
                    : hasResume
                      ? (profile.data?.resumeFilename ?? "Resume attached")
                      : "Upload your resume"}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {hasResume
                    ? `Parsed and stored${upload.data ? ` — ${upload.data.characters.toLocaleString()} characters` : ""}. Click to replace.`
                    : "PDF, TXT or Markdown · up to a few MB"}
                </span>
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  className="field"
                  value={draft.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder="Jordan Reyes"
                />
              </Field>
              <Field label="Email on applications">
                <input
                  className="field"
                  type="email"
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@email.com"
                />
              </Field>
              <Field label="Phone">
                <input
                  className="field"
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+1 555 0100"
                />
              </Field>
              <Field label="Where you're based">
                <input
                  className="field"
                  value={draft.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Berlin, Germany"
                />
              </Field>
            </div>

            <Field
              label="Anything the resume leaves out"
              hint="Optional. Context, a career change, projects — the AI uses it when the resume is thin."
            >
              <textarea
                className="field min-h-[110px] resize-y"
                value={draft.extraNotes}
                onChange={(e) => set("extraNotes", e.target.value)}
                placeholder="Switching from agency work to product teams. Led the payments rewrite at…"
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="LinkedIn">
              <input
                className="field"
                value={draft.linkedinUrl}
                onChange={(e) => set("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/…"
              />
            </Field>
            <Field label="Portfolio or personal site">
              <input
                className="field"
                value={draft.portfolioUrl}
                onChange={(e) => set("portfolioUrl", e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="GitHub">
              <input
                className="field"
                value={draft.githubUrl}
                onChange={(e) => set("githubUrl", e.target.value)}
                placeholder="https://github.com/…"
              />
            </Field>
            <Field label="Anything else" hint="Dribbble, Substack, a case study, a paper.">
              <TagInput
                value={draft.otherLinks}
                onChange={(v) => set("otherLinks", v)}
                placeholder="https://…"
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field
              label="Job titles you want"
              hint="Press Enter to add. These are matched against every listing."
            >
              <TagInput
                value={draft.desiredTitles}
                onChange={(v) => set("desiredTitles", v)}
                placeholder="Senior Product Designer"
                suggestions={suggested}
              />
            </Field>
            <Field label="Locations that work" hint="Leave empty for anywhere.">
              <TagInput
                value={draft.desiredLocations}
                onChange={(v) => set("desiredLocations", v)}
                placeholder="London"
              />
            </Field>
            <Field label="Working arrangement">
              <Choice
                value={draft.remotePreference}
                onChange={(v) => set("remotePreference", v)}
                options={[
                  { value: "any", label: "No preference" },
                  { value: "remote", label: "Remote only" },
                  { value: "hybrid", label: "Hybrid" },
                  { value: "onsite", label: "On-site" },
                ]}
              />
            </Field>
            <Field label="Industries you'd lean toward" hint="Optional.">
              <TagInput
                value={draft.industries}
                onChange={(v) => set("industries", v)}
                placeholder="Fintech"
              />
            </Field>

            {profile.data?.aiSummary && (
              <div className="panel p-5">
                <p className="eyebrow flex items-center gap-2">
                  <Sparkles className="size-3 text-primary" /> What the AI read about you
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {profile.data.aiSummary}
                </p>
                {!!profile.data.aiSkills?.length && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {profile.data.aiSkills.slice(0, 14).map((s) => (
                      <span key={s} className="chip normal-case tracking-normal">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Years of experience">
                <input
                  className="field"
                  inputMode="numeric"
                  value={draft.yearsExperience}
                  onChange={(e) => set("yearsExperience", e.target.value.replace(/\D/g, ""))}
                  placeholder="7"
                />
              </Field>
              <Field label="Seniority">
                <input
                  className="field"
                  value={draft.seniority}
                  onChange={(e) => set("seniority", e.target.value)}
                  placeholder="Senior"
                />
              </Field>
            </div>
            <Field label="Work authorization" hint="Exactly how you'd answer it on a form.">
              <input
                className="field"
                value={draft.workAuthorization}
                onChange={(e) => set("workAuthorization", e.target.value)}
                placeholder="EU citizen, authorized to work in Germany"
              />
            </Field>
            <Switch
              checked={draft.requiresSponsorship}
              onChange={(v) => set("requiresSponsorship", v)}
              label="I would need visa sponsorship"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Salary expectation">
                <input
                  className="field"
                  value={draft.salaryExpectation}
                  onChange={(e) => set("salaryExpectation", e.target.value)}
                  placeholder="€95–110k"
                />
              </Field>
              <Field label="Notice period">
                <input
                  className="field"
                  value={draft.noticePeriod}
                  onChange={(e) => set("noticePeriod", e.target.value)}
                  placeholder="1 month"
                />
              </Field>
            </div>
            <Switch
              checked={draft.willingToRelocate}
              onChange={(v) => set("willingToRelocate", v)}
              label="Open to relocating for the right role"
            />
            <Field label="Pronouns" hint="Optional — only used when a form asks.">
              <input
                className="field"
                value={draft.pronouns}
                onChange={(e) => set("pronouns", e.target.value)}
                placeholder="she/her"
              />
            </Field>
          </>
        )}

        <ErrorNote error={error} />

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button type="button" size="lg" onClick={next} disabled={busy}>
            {busy ? <Spinner /> : null}
            {analyze.isPending
              ? "Reading your resume…"
              : step === 3
                ? "Finish and see my feed"
                : "Continue"}
            {!busy && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
