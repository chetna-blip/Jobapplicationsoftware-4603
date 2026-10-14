import { useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHead } from "../components/shell";
import { Empty, ErrorNote, ScoreBadge, SkeletonRow, Spinner, StatusPill, timeAgo } from "../components/bits";
import { useApplications, useUpdateApplication } from "../queries/applications";

const TABS = [
  { value: "all", label: "Everything" },
  { value: "needs_review", label: "Ready to submit" },
  { value: "submitted_manually", label: "Submitted" },
  { value: "skipped", label: "Skipped" },
] as const;

type Tab = (typeof TABS)[number]["value"];

function Applications() {
  const [tab, setTab] = useState<Tab>("all");
  const list = useApplications(tab);
  const update = useUpdateApplication();
  const rows = list.data ?? [];

  const counts = {
    ready: rows.filter((r) => r.status === "needs_review").length,
    submitted: rows.filter((r) => r.status === "submitted_manually").length,
  };

  return (
    <>
      <PageHead
        eyebrow={
          tab === "all"
            ? `${rows.length} tracked · ${counts.ready} ready · ${counts.submitted} submitted`
            : "Filtered"
        }
        title="Applications"
        sub="Everything the AI has written for you, and where each one stands."
      />

      <div className="rise mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
              tab === t.value
                ? "border-primary bg-primary/12 text-foreground"
                : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorNote error={list.error ?? update.error} />

      <div className="rise panel overflow-hidden" style={{ "--d": "80ms" } as React.CSSProperties}>
        {list.isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : rows.length === 0 ? (
          <Empty
            title="Nothing here yet"
            body="Open a job from the feed and have the AI write the application — it shows up here the moment it's drafted."
            action={
              <Button asChild>
                <Link to="/jobs">Go to the feed</Link>
              </Button>
            }
          />
        ) : (
          rows.map((row, i) => (
            <div
              key={row.id}
              className={cn(
                "flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4",
                i > 0 && "border-t border-border",
              )}
            >
              <div className="w-12 shrink-0 text-center">
                <ScoreBadge score={row.score} />
              </div>
              <div className="min-w-[200px] flex-1">
                <Link
                  to={`/jobs/${row.jobId}`}
                  className="font-display text-[15px] font-bold tracking-[-0.02em] text-foreground hover:text-primary"
                >
                  {row.job.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span>{row.job.company}</span>
                  <span>{row.job.location ?? "—"}</span>
                  <span className="font-mono">
                    {row.status === "submitted_manually" && row.submittedAt
                      ? `submitted ${timeAgo(row.submittedAt)}`
                      : `updated ${timeAgo(row.updatedAt)}`}
                  </span>
                </div>
              </div>
              <StatusPill status={row.status} />
              <div className="flex items-center gap-2">
                {row.status !== "submitted_manually" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => update.mutate({ jobId: row.jobId, status: "submitted_manually" })}
                    disabled={update.isPending}
                  >
                    {update.isPending ? <Spinner /> : <Check className="size-3.5" />} Mark submitted
                  </Button>
                )}
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/jobs/${row.jobId}`}>
                    Open <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default Applications;
