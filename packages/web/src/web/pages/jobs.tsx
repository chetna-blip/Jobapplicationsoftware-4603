import { useState } from "react";
import { Link } from "wouter";
import { ChevronRight, MapPin, RefreshCw, Search, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHead } from "../components/shell";
import {
  Empty,
  ErrorNote,
  ScoreBadge,
  SkeletonRow,
  SourceTag,
  Spinner,
  StatusPill,
  timeAgo,
} from "../components/bits";
import { defaultFilters, useFeed, useJobStats, useRankJobs, useRefreshJobs } from "../queries/jobs";

const SORTS = [
  { value: "score", label: "Best match" },
  { value: "newest", label: "Newest" },
] as const;

const SOURCES = [
  { value: "all", label: "All boards" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
] as const;

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
        active
          ? "border-primary bg-primary/12 text-foreground"
          : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Jobs() {
  const [filters, setFilters] = useState(defaultFilters);
  const [search, setSearch] = useState("");
  const feed = useFeed(filters);
  const stats = useJobStats();
  const refresh = useRefreshJobs();
  const rank = useRankJobs();

  const items = feed.data?.items ?? [];
  const scoredCount = feed.data?.scoredCount ?? 0;

  return (
    <>
      <PageHead
        eyebrow={
          stats.data
            ? `${stats.data.total.toLocaleString()} live listings · ${stats.data.companies} companies · refreshed ${timeAgo(stats.data.lastRefreshedAt)}`
            : "Loading board data"
        }
        title="Job feed"
        sub="Pulled straight from company boards, scored against your profile. Open one and the application gets written."
        right={
          <>
            <Button
              variant="outline"
              onClick={() => refresh.mutate({} as never)}
              disabled={refresh.isPending}
            >
              {refresh.isPending ? <Spinner /> : <RefreshCw className="size-4" />} Refresh listings
            </Button>
            <Button onClick={() => rank.mutate({ limit: 24 })} disabled={rank.isPending}>
              {rank.isPending ? <Spinner /> : <Wand2 className="size-4" />} Score new jobs
            </Button>
          </>
        }
      />

      {(refresh.data || rank.data) && (
        <div className="rise panel mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5 text-sm">
          {refresh.data && (
            <span className="text-muted-foreground">
              <span className="text-foreground">{refresh.data.jobsInserted}</span> new ·{" "}
              <span className="text-foreground">{refresh.data.jobsUpdated}</span> updated from{" "}
              {refresh.data.boardsOk} boards
              {refresh.data.boardsFailed ? ` (${refresh.data.boardsFailed} failed)` : ""}
            </span>
          )}
          {rank.data && (
            <span className="text-muted-foreground">
              {"scored" in rank.data ? rank.data.scored : 0} newly scored
              {"top" in rank.data && rank.data.top?.length
                ? ` · best: ${rank.data.top[0]!.title} at ${rank.data.top[0]!.company} (${Math.round(rank.data.top[0]!.score)})`
                : ""}
              {"message" in rank.data && rank.data.message ? ` · ${rank.data.message}` : ""}
            </span>
          )}
        </div>
      )}
      <ErrorNote error={rank.error ?? refresh.error} />

      <div
        className="rise mb-6 flex flex-wrap items-center gap-2.5"
        style={{ "--d": "60ms" } as React.CSSProperties}
      >
        <form
          className="relative min-w-[240px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((f) => ({ ...f, search, offset: 0 }));
          }}
        >
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="field pl-10"
            placeholder="Title, company or city — press Enter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {SOURCES.map((s) => (
          <Pill
            key={s.value}
            active={filters.source === s.value}
            onClick={() => setFilters((f) => ({ ...f, source: s.value, offset: 0 }))}
          >
            {s.label}
          </Pill>
        ))}
        <Pill
          active={filters.remoteOnly}
          onClick={() => setFilters((f) => ({ ...f, remoteOnly: !f.remoteOnly, offset: 0 }))}
        >
          Remote only
        </Pill>
        <Pill
          active={filters.minScore > 0}
          onClick={() => setFilters((f) => ({ ...f, minScore: f.minScore > 0 ? 0 : 70, offset: 0 }))}
        >
          Score 70+
        </Pill>
        {SORTS.map((s) => (
          <Pill
            key={s.value}
            active={filters.sort === s.value}
            onClick={() => setFilters((f) => ({ ...f, sort: s.value, offset: 0 }))}
          >
            {s.label}
          </Pill>
        ))}
      </div>

      {scoredCount === 0 && !feed.isLoading && (
        <div className="rise panel mb-5 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            Nothing is scored yet. Run the matcher once and the feed sorts itself around you.
          </p>
          <Button size="sm" onClick={() => rank.mutate({ limit: 24 })} disabled={rank.isPending}>
            {rank.isPending ? <Spinner /> : null} Score now
          </Button>
        </div>
      )}

      <div className="rise panel overflow-hidden" style={{ "--d": "120ms" } as React.CSSProperties}>
        {feed.isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : feed.isError ? (
          <div className="p-5">
            <ErrorNote error={feed.error} />
          </div>
        ) : items.length === 0 ? (
          <Empty
            title="Nothing matches those filters"
            body="Loosen a filter, or pull today's listings from every board."
            action={
              <Button
                variant="outline"
                onClick={() => refresh.mutate({} as never)}
                disabled={refresh.isPending}
              >
                {refresh.isPending ? <Spinner /> : <RefreshCw className="size-4" />} Refresh listings
              </Button>
            }
          />
        ) : (
          items.map((job, i) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className={cn(
                "group flex items-center gap-5 px-5 py-4 transition-colors hover:bg-surface-2/60",
                i > 0 && "border-t border-border",
              )}
            >
              <div className="w-12 shrink-0 text-center">
                <ScoreBadge score={job.score} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-display text-[15px] font-bold tracking-[-0.02em] text-foreground">
                    {job.title}
                  </span>
                  <span className="text-sm text-muted-foreground">{job.company}</span>
                  <StatusPill status={job.applicationStatus} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {job.location ?? "—"}
                  </span>
                  {job.isRemote && <span className="text-primary/80">Remote</span>}
                  {job.team && <span>{job.team}</span>}
                  <SourceTag source={job.source} />
                  <span className="font-mono">{timeAgo(job.postedAt ?? job.firstSeenAt)}</span>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))
        )}
      </div>

      {items.length >= filters.limit && (
        <div className="mt-5 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setFilters((f) => ({ ...f, limit: f.limit + 40 }))}
            disabled={feed.isFetching}
          >
            {feed.isFetching ? <Spinner /> : null} Show more
          </Button>
        </div>
      )}
    </>
  );
}

export default Jobs;
