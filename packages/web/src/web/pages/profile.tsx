import { useEffect, useRef, useState } from "react";
import { Check, Download, FileText, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalyzeProfile, useProfile, useUpdateProfile, useUploadResume } from "../queries/profile";
import { Choice, Field, Switch, TagInput } from "../components/form";
import { ErrorNote, Loading, Spinner } from "../components/bits";
import { PageHead } from "../components/shell";

type Draft = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
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
  headline: "",
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

function Panel({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface-1 p-5 sm:p-6">
      <h2 className="font-display text-[17px] font-bold tracking-[-0.02em]">{title}</h2>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Profile() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const upload = useUploadResume();
  const analyze = useAnalyzeProfile();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = profile.data;
    if (!p || hydrated.current) return;
    hydrated.current = true;
    setDraft({
      fullName: p.fullName ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      location: p.location ?? "",
      headline: p.headline ?? "",
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
    });
  }, [profile.data]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  const busy = update.isPending || analyze.isPending || upload.isPending;
  const p = profile.data;
  const suggested = p?.aiSuggestedTitles ?? [];

  async function onFile(file: File) {
    setError(null);
    try {
      await upload.mutateAsync(file);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onAnalyze() {
    setError(null);
    try {
      // Persist links first so the analyzer reads the current ones.
      await save(false);
      const res = await analyze.mutateAsync({});
      if (!draft.desiredTitles.length && res.suggestedTitles?.length) {
        set("desiredTitles", res.suggestedTitles.slice(0, 4));
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function save(flash = true) {
    setError(null);
    const years = draft.yearsExperience.trim();
    try {
      await update.mutateAsync({
        fullName: draft.fullName || null,
        email: draft.email || null,
        phone: draft.phone || null,
        location: draft.location || null,
        headline: draft.headline || null,
        extraNotes: draft.extraNotes || null,
        linkedinUrl: draft.linkedinUrl || null,
        portfolioUrl: draft.portfolioUrl || null,
        githubUrl: draft.githubUrl || null,
        otherLinks: draft.otherLinks,
        desiredTitles: draft.desiredTitles,
        desiredLocations: draft.desiredLocations,
        industries: draft.industries,
        remotePreference: draft.remotePreference,
        yearsExperience: years ? Math.max(0, Math.min(60, Number(years) || 0)) : null,
        seniority: draft.seniority || null,
        workAuthorization: draft.workAuthorization || null,
        requiresSponsorship: draft.requiresSponsorship,
        salaryExpectation: draft.salaryExpectation || null,
        noticePeriod: draft.noticePeriod || null,
        willingToRelocate: draft.willingToRelocate,
        pronouns: draft.pronouns || null,
      });
      if (flash) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }

  if (profile.isLoading) return <Loading label="Loading your profile" />;

  return (
    <>
      <PageHead
        eyebrow="Your profile"
        title="Profile"
        sub="Everything the AI uses to score jobs and write your applications."
        right={
          <div className="flex items-center gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                <Check className="size-3" /> Saved
              </span>
            )}
            <Button onClick={() => void save()} disabled={busy}>
              {update.isPending ? <Spinner /> : null} Save changes
            </Button>
          </div>
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Panel title="You" sub="Used to fill the name, email and phone fields on every form.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  className="field"
                  value={draft.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                />
              </Field>
              <Field label="Email">
                <input
                  className="field"
                  type="email"
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="field"
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field label="Location">
                <input
                  className="field"
                  value={draft.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Berlin, Germany"
                />
              </Field>
              <Field label="Headline" className="sm:col-span-2">
                <input
                  className="field"
                  value={draft.headline}
                  onChange={(e) => set("headline", e.target.value)}
                  placeholder="Senior backend engineer, payments and infra"
                />
              </Field>
              <Field label="Pronouns">
                <input
                  className="field"
                  value={draft.pronouns}
                  onChange={(e) => set("pronouns", e.target.value)}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Links" sub="Public pages the AI reads to understand your work.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="LinkedIn">
                <input
                  className="field"
                  value={draft.linkedinUrl}
                  onChange={(e) => set("linkedinUrl", e.target.value)}
                  placeholder="https://linkedin.com/in/…"
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
              <Field label="Portfolio or site" className="sm:col-span-2">
                <input
                  className="field"
                  value={draft.portfolioUrl}
                  onChange={(e) => set("portfolioUrl", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </div>
            <Field label="Other links">
              <TagInput
                value={draft.otherLinks}
                onChange={(v) => set("otherLinks", v)}
                placeholder="https://…"
              />
            </Field>
          </Panel>

          <Panel title="What you're looking for" sub="This drives the match score on every job.">
            <Field label="Target titles">
              <TagInput
                value={draft.desiredTitles}
                onChange={(v) => set("desiredTitles", v)}
                placeholder="Product designer"
                suggestions={suggested}
              />
            </Field>
            <Field label="Target locations">
              <TagInput
                value={draft.desiredLocations}
                onChange={(v) => set("desiredLocations", v)}
                placeholder="London"
              />
            </Field>
            <Field label="Work setup">
              <Choice
                value={draft.remotePreference}
                onChange={(v) => set("remotePreference", v)}
                options={[
                  { value: "any", label: "Any" },
                  { value: "remote", label: "Remote only" },
                  { value: "hybrid", label: "Hybrid" },
                  { value: "onsite", label: "On-site" },
                ]}
              />
            </Field>
            <Field label="Industries">
              <TagInput
                value={draft.industries}
                onChange={(v) => set("industries", v)}
                placeholder="Fintech"
              />
            </Field>
          </Panel>

          <Panel title="Application details" sub="The awkward questions every form asks, answered once.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Years of experience">
                <input
                  className="field"
                  inputMode="numeric"
                  value={draft.yearsExperience}
                  onChange={(e) => set("yearsExperience", e.target.value.replace(/[^\d]/g, ""))}
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
              <Field label="Work authorization">
                <input
                  className="field"
                  value={draft.workAuthorization}
                  onChange={(e) => set("workAuthorization", e.target.value)}
                  placeholder="EU citizen, no visa needed"
                />
              </Field>
              <Field label="Salary expectation">
                <input
                  className="field"
                  value={draft.salaryExpectation}
                  onChange={(e) => set("salaryExpectation", e.target.value)}
                  placeholder="€90–110k"
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
            <div className="grid gap-3 sm:grid-cols-2">
              <Switch
                checked={draft.requiresSponsorship}
                onChange={(v) => set("requiresSponsorship", v)}
                label="I need visa sponsorship"
              />
              <Switch
                checked={draft.willingToRelocate}
                onChange={(v) => set("willingToRelocate", v)}
                label="I'd relocate for the right role"
              />
            </div>
            <Field
              label="Anything else"
              hint="Context the AI should use when it writes for you — constraints, goals, things the resume misses."
            >
              <textarea
                className="field min-h-[130px] resize-y"
                value={draft.extraNotes}
                onChange={(e) => set("extraNotes", e.target.value)}
              />
            </Field>
          </Panel>
        </div>

        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Resume">
            {p?.resumeFilename ? (
              <div className="rounded-md border border-border bg-surface-2 p-3.5">
                <p className="flex items-start gap-2 text-sm text-foreground">
                  <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="break-all">{p.resumeFilename}</span>
                </p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {p.hasResumeText ? "Text extracted" : "No text found"}
                </p>
                {p.resumeUrl && (
                  <a
                    href={p.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Download className="size-3.5" /> Download
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No resume yet.</p>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {upload.isPending ? <Spinner /> : <Upload className="size-4" />}
              {p?.resumeFilename ? "Replace resume" : "Upload resume"}
            </Button>
          </Panel>

          <Panel title="AI read of you" sub="Re-run this after changing your resume or links.">
            {p?.aiSummary ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{p.aiSummary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing analyzed yet.</p>
            )}
            {!!p?.aiSkills?.length && (
              <div className="flex flex-wrap gap-1.5">
                {p.aiSkills.slice(0, 18).map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => void onAnalyze()} disabled={busy}>
              {analyze.isPending ? <Spinner /> : <Sparkles className="size-4" />}
              Re-analyze
            </Button>
          </Panel>
        </div>
      </div>
    </>
  );
}

export default Profile;
