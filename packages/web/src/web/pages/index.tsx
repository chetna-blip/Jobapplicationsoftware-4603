import { Link, Redirect } from "wouter";
import { ArrowUpRight, Briefcase, FileText, MousePointerClick, Radar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "../lib/auth";
import { useJobStats, useSources } from "../queries/jobs";
import { Backdrop } from "../components/shell";

const STEPS = [
  {
    icon: FileText,
    title: "Upload once",
    body: "Resume gets parsed, your links get read, and the AI builds the profile it will apply with — including the target titles it derives from your own history.",
  },
  {
    icon: Radar,
    title: "Fresh listings daily",
    body: "Greenhouse and Lever boards are pulled every day straight from their public APIs. No stale reposts, no aggregator spam.",
  },
  {
    icon: Sparkles,
    title: "Scored against you",
    body: "Every plausible listing is graded 0–100 with the reasoning, your strengths for the role, and the gaps you'd have to talk around.",
  },
  {
    icon: MousePointerClick,
    title: "Written, then one click",
    body: "A tailored cover letter plus an answer to every screening question the posting publishes. One click fills the real form in your browser — you press Submit.",
  },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-l border-border pl-4">
      <p className="font-display text-[1.75rem] font-extrabold leading-none tabular-nums">{value}</p>
      <p className="eyebrow mt-2">{label}</p>
    </div>
  );
}

function Index() {
  const { data: session, isPending } = authClient.useSession();
  const stats = useJobStats();
  const sources = useSources();

  if (!isPending && session) return <Redirect to="/jobs" />;

  return (
    <div className="min-h-dvh">
      <Backdrop />

      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="size-4" />
          </span>
          <span className="font-display text-[15px] font-extrabold tracking-[-0.03em]">
            Apply<span className="text-primary">Copilot</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/sign-up">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="grid-lines border-y border-border">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="eyebrow rise">Job search, automated to the last click</p>
          <h1 className="rise mt-5 max-w-[19ch] text-[clamp(2.6rem,7vw,4.75rem)]" style={{ "--d": "60ms" } as React.CSSProperties}>
            Your applications, <span className="text-primary">already written</span> when you wake up.
          </h1>
          <p
            className="rise mt-6 max-w-[58ch] text-[1.05rem] leading-relaxed text-muted-foreground"
            style={{ "--d": "120ms" } as React.CSSProperties}
          >
            Apply Copilot pulls every fresh listing from dozens of company job boards, scores them
            against your actual resume, and writes the whole application — cover letter and every
            screening question. Then it fills the real form for you in one click.
          </p>

          <div
            className="rise mt-9 flex flex-wrap items-center gap-3"
            style={{ "--d": "180ms" } as React.CSSProperties}
          >
            <Button asChild size="lg">
              <Link to="/sign-up">
                Start free <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/sign-in">I already have an account</Link>
            </Button>
          </div>

          <div
            className="rise mt-16 grid max-w-2xl grid-cols-2 gap-y-8 sm:grid-cols-4"
            style={{ "--d": "240ms" } as React.CSSProperties}
          >
            <Stat value={stats.data ? stats.data.total.toLocaleString() : "—"} label="Live listings" />
            <Stat value={stats.data ? stats.data.companies.toLocaleString() : "—"} label="Companies" />
            <Stat value={stats.data ? stats.data.remote.toLocaleString() : "—"} label="Remote roles" />
            <Stat value={sources.data ? `${sources.data.boards}` : "—"} label="Boards tracked" />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1180px] px-5 py-20 sm:px-8">
        <p className="eyebrow">How it works</p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <div key={s.title} className="bg-card p-7">
              <div className="flex items-center gap-3">
                <s.icon className="size-4 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-xl">{s.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="panel mt-6 p-7">
          <p className="eyebrow">Straight answer on "auto-apply"</p>
          <p className="mt-3 max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
            No third-party tool can silently submit to Greenhouse or Lever — both require the
            employer's own private API key, and driving a bot through LinkedIn or Indeed logins
            breaks their terms and gets accounts banned. So Apply Copilot does everything up to the
            last click: it drafts the full application, then fills the live form inside your own
            browser session. You read it and press Submit. Roughly thirty seconds a job instead of
            twenty minutes, without risking your accounts.
          </p>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 py-8 sm:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Apply Copilot
          </p>
          <p className="text-xs text-muted-foreground">
            Listings from public Greenhouse &amp; Lever boards.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Index;
