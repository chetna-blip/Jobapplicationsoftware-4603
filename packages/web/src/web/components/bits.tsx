import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-16 text-sm text-muted-foreground">
      <Spinner />
      <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-border px-5 py-5">
      <div className="flex-1 space-y-2.5">
        <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2/70" />
      </div>
      <div className="h-8 w-12 animate-pulse rounded bg-surface-2" />
    </div>
  );
}

/** Match score, colour-ramped: 85+ lime, 70-84 bone, below that muted. */
export function ScoreBadge({ score, size = "md" }: { score?: number | null; size?: "sm" | "md" | "lg" }) {
  if (score == null) {
    return (
      <span
        className={cn(
          "font-mono text-muted-foreground/50",
          size === "lg" ? "text-2xl" : size === "sm" ? "text-[11px]" : "text-sm",
        )}
        title="Not scored yet"
      >
        —
      </span>
    );
  }
  const tone =
    score >= 85 ? "text-primary" : score >= 70 ? "text-foreground" : "text-muted-foreground";
  return (
    <span
      className={cn(
        "font-mono font-medium tabular-nums",
        tone,
        size === "lg" ? "text-4xl" : size === "sm" ? "text-xs" : "text-lg",
      )}
    >
      {Math.round(score)}
    </span>
  );
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  drafted: { label: "Drafted", className: "text-muted-foreground border-border" },
  needs_review: { label: "Ready to submit", className: "text-amber border-amber/35 bg-amber/10" },
  submitted_manually: { label: "Submitted", className: "text-primary border-primary/35 bg-primary/10" },
  failed: { label: "Failed", className: "text-destructive border-destructive/35 bg-destructive/10" },
  skipped: { label: "Skipped", className: "text-muted-foreground border-border" },
};

export function StatusPill({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = STATUS_STYLE[status] ?? { label: status, className: "text-muted-foreground border-border" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}

export function SourceTag({ source }: { source: string }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
      {source}
    </span>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <h3 className="text-xl">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
      {message}
    </p>
  );
}

export function timeAgo(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 31) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
