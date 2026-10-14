import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  MousePointerClick,
  Pencil,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "../lib/sanitize";
import { useJob } from "../queries/jobs";
import { useAutofill, useDraftApplication, useUpdateApplication } from "../queries/applications";
import { ErrorNote, Loading, ScoreBadge, SourceTag, Spinner, StatusPill, timeAgo } from "../components/bits";

/**
 * React refuses to render a `javascript:` href, so the bookmarklet URL is written
 * onto the node directly — that's what makes it draggable to the bookmarks bar.
 */
function BookmarkletLink({ href }: { href: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", href);
  }, [href]);
  return (
    <a
      ref={ref}
      draggable
      onClick={(e) => e.preventDefault()}
      className="mt-2.5 inline-flex cursor-grab items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground"
    >
      <MousePointerClick className="size-3.5 text-primary" /> Fill this application
    </a>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-primary"
    >
      {done ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
      {done ? "Copied" : label}
    </button>
  );
}

function Panel({
  title,
  right,
  children,
  delay = 0,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <section className="rise panel p-5 sm:p-6" style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="eyebrow">{title}</p>
        {right}
      </div>
      {children}
    </section>
  );
}

function Job() {
  const params = useParams();
  const id = Number(params.id);
  const { data, isLoading, isError, error } = useJob(id);
  const draft = useDraftApplication();
  const update = useUpdateApplication();

  const application = data?.application ?? null;
  const hasDraft = !!application?.coverLetter;
  const autofill = useAutofill(id, hasDraft);

  const [editing, setEditing] = useState(false);
  const [letter, setLetter] = useState("");
  const [answers, setAnswers] = useState<{ name?: string; label: string; answer: string }[]>([]);

  useEffect(() => {
    if (!application) return;
    setLetter(application.coverLetter ?? "");
    setAnswers(
      (application.answers ?? []).map((a) => ({ name: a.name, label: a.label, answer: a.answer })),
    );
  }, [application?.id, application?.updatedAt]);

  const description = useMemo(() => sanitizeHtml(data?.job.description), [data?.job.description]);

  if (isLoading) return <Loading label="Loading job" />;
  if (isError || !data) return <ErrorNote error={error ?? "Job not found"} />;

  const { job, match } = data;

  return (
    <>
      <Link
        to="/jobs"
        className="rise mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Back to feed
      </Link>

      <div className="rise mb-8 flex flex-wrap items-start justify-between gap-6" style={{ "--d": "40ms" } as React.CSSProperties}>
        <div className="min-w-0">
          <p className="eyebrow">
            {job.company}
            {job.team ? ` · ${job.team}` : ""}
          </p>
          <h1 className="mt-2 max-w-[24ch] text-[clamp(1.6rem,3.4vw,2.35rem)]">{job.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {job.location ?? "—"}
            </span>
            {job.isRemote && <span className="text-primary/80">Remote</span>}
            {job.commitment && <span>{job.commitment}</span>}
            <SourceTag source={job.source} />
            <span className="font-mono text-xs">posted {timeAgo(job.postedAt ?? job.firstSeenAt)}</span>
            <StatusPill status={application?.status} />
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <ScoreBadge score={match?.score} size="lg" />
            <p className="eyebrow mt-1">Match</p>
          </div>
          <Button asChild variant="outline">
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              Posting <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          {match && (
            <Panel title="Why this scored the way it did" delay={80}>
              {match.reasoning && (
                <p className="text-sm leading-relaxed text-muted-foreground">{match.reasoning}</p>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {!!match.strengths?.length && (
                  <div>
                    <p className="eyebrow text-primary/80">In your favour</p>
                    <ul className="mt-2 space-y-1.5">
                      {match.strengths.map((s) => (
                        <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                          {/* AI-written phrases arrive with slash-joined tokens that overflow a
                              narrow column, so break inside a word when there is no other choice. */}
                          <span className="[overflow-wrap:anywhere]">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!match.gaps?.length && (
                  <div>
                    <p className="eyebrow">Gaps to talk around</p>
                    <ul className="mt-2 space-y-1.5">
                      {match.gaps.map((g) => (
                        <li key={g} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber" />
                          <span className="[overflow-wrap:anywhere]">{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Panel>
          )}

          <Panel
            title="Your application"
            delay={120}
            right={
              hasDraft ? (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setEditing((v) => !v)}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="size-3" /> {editing ? "Done" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => draft.mutate({ jobId: id, force: true })}
                    disabled={draft.isPending}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
                  >
                    {draft.isPending ? <Spinner className="size-3" /> : <Wand2 className="size-3" />}{" "}
                    Rewrite
                  </button>
                </div>
              ) : undefined
            }
          >
            {!hasDraft ? (
              <div className="py-4">
                <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
                  The AI will write a cover letter for this specific posting and answer every
                  screening question it publishes — using your resume, links and the facts from
                  onboarding.
                </p>
                <Button
                  className="mt-5"
                  onClick={() => draft.mutate({ jobId: id, force: false })}
                  disabled={draft.isPending}
                >
                  {draft.isPending ? <Spinner /> : <Sparkles className="size-4" />}
                  {draft.isPending ? "Writing it…" : "Write my application"}
                </Button>
                <ErrorNote error={draft.error} />
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm text-foreground">Cover letter</p>
                    <CopyButton text={letter} />
                  </div>
                  {editing ? (
                    <textarea
                      className="field min-h-[280px] resize-y leading-relaxed"
                      value={letter}
                      onChange={(e) => setLetter(e.target.value)}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap rounded-md border border-border bg-surface-2/50 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
                      {letter}
                    </p>
                  )}
                </div>

                {answers.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-sm text-foreground">
                      Screening answers{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        ({answers.length})
                      </span>
                    </p>
                    {answers.map((a, i) => (
                      <div key={`${a.label}-${i}`}>
                        <div className="mb-1.5 flex items-start justify-between gap-3">
                          <p className="text-xs text-muted-foreground">{a.label}</p>
                          <CopyButton text={a.answer} />
                        </div>
                        {editing ? (
                          <textarea
                            className="field min-h-[80px] resize-y"
                            value={a.answer}
                            onChange={(e) =>
                              setAnswers((prev) =>
                                prev.map((p, pi) => (pi === i ? { ...p, answer: e.target.value } : p)),
                              )
                            }
                          />
                        ) : (
                          <p className="rounded-md border border-border bg-surface-2/50 px-3.5 py-2.5 text-sm text-foreground">
                            {a.answer}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {editing && (
                  <Button
                    onClick={() =>
                      update.mutate(
                        { jobId: id, coverLetter: letter, answers },
                        { onSuccess: () => setEditing(false) },
                      )
                    }
                    disabled={update.isPending}
                  >
                    {update.isPending ? <Spinner /> : null} Save edits
                  </Button>
                )}
                <ErrorNote error={update.error ?? draft.error} />
              </div>
            )}
          </Panel>

          <Panel title="The posting" delay={160}>
            {description ? (
              <div
                className="prose-job max-w-none text-sm leading-relaxed text-muted-foreground [&_a]:text-info [&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-base [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-base [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-sm [&_li]:my-1 [&_li]:ml-4 [&_li]:list-disc [&_p]:my-3 [&_strong]:text-foreground [&_ul]:my-3"
                // Third-party board HTML, stripped of everything executable by sanitizeHtml.
                dangerouslySetInnerHTML={{ __html: description }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                This board didn't publish a description body — open the posting for the full text.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Submit it" delay={200}>
            {!hasDraft ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Write the application first and the autofill kit shows up here.
              </p>
            ) : autofill.isLoading ? (
              <Loading label="Building autofill" />
            ) : autofill.isError ? (
              <ErrorNote error={autofill.error} />
            ) : autofill.data ? (
              <div className="space-y-5">
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                      1
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">Keep the filler handy</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Drag this to your bookmarks bar once. It works on every application after
                        this one.
                      </p>
                      <BookmarkletLink href={autofill.data.bookmarklet} />
                      <div className="mt-2">
                        <CopyButton text={autofill.data.snippet} label="Copy console snippet instead" />
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                      2
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">Open the real form and click it</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Every value below gets written into the form. Attach your resume file, pick
                        any searchable dropdowns yourself (browsers only accept real keystrokes
                        there), read it over, then press the page's own Submit.
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <a href={autofill.data.applyUrl} target="_blank" rel="noopener noreferrer">
                            Open apply page <ExternalLink className="size-3.5" />
                          </a>
                        </Button>
                        {autofill.data.resumeUrl && (
                          <Button asChild variant="outline" size="sm">
                            <a href={autofill.data.resumeUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="size-3.5" />{" "}
                              {autofill.data.resumeFilename ?? "Resume"}
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                      3
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">Mark it done</p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={application?.status === "submitted_manually" ? "outline" : "default"}
                          onClick={() => update.mutate({ jobId: id, status: "submitted_manually" })}
                          disabled={update.isPending}
                        >
                          {update.isPending ? <Spinner /> : <Check className="size-3.5" />}
                          {application?.status === "submitted_manually" ? "Submitted" : "I submitted it"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => update.mutate({ jobId: id, status: "skipped" })}
                          disabled={update.isPending}
                        >
                          Skip this one
                        </Button>
                      </div>
                    </div>
                  </li>
                </ol>

                <details className="border-t border-border pt-4">
                  <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
                    {autofill.data.fields.length} values it will fill
                  </summary>
                  <div className="mt-3 space-y-2.5">
                    {autofill.data.fields.map((f, i) => (
                      <div key={`${f.name ?? f.label}-${i}`} className="flex items-start gap-3">
                        <span className="w-[38%] shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                          {f.label}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                          {f.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ) : null}
          </Panel>

          <div
            className={cn("rise rounded-xl border border-border bg-card/60 p-5")}
            style={{ "--d": "240ms" } as React.CSSProperties}
          >
            <p className="eyebrow">Why the last click is yours</p>
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
              Greenhouse and Lever only accept applications from the employer's own API key — no
              outside tool can submit for you, and bots driving job-site logins get accounts banned.
              So everything up to Submit is automated, and the submission stays in your hands.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default Job;
