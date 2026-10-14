import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { authClient } from "../lib/auth";

export interface FeedFilters {
  search?: string;
  source: "all" | "greenhouse" | "lever";
  remoteOnly: boolean;
  minScore: number;
  sort: "score" | "newest";
  limit: number;
  offset: number;
}

export const defaultFilters: FeedFilters = {
  search: "",
  source: "all",
  remoteOnly: false,
  minScore: 0,
  sort: "score",
  limit: 40,
  offset: 0,
};

export function useJobStats() {
  return useQuery(orpc.jobs.stats.queryOptions({ staleTime: 60_000 }));
}

export function useSources() {
  return useQuery(orpc.jobs.sources.queryOptions({ staleTime: Infinity }));
}

export function useFeed(filters: FeedFilters) {
  const { data: session } = authClient.useSession();
  return useQuery(
    orpc.jobs.feed.queryOptions({
      input: filters,
      enabled: !!session,
      staleTime: 10_000,
    }),
  );
}

export function useJob(id: number) {
  const { data: session } = authClient.useSession();
  return useQuery(
    orpc.jobs.get.queryOptions({ input: { id }, enabled: !!session && Number.isFinite(id) }),
  );
}

export function useRefreshJobs() {
  const qc = useQueryClient();
  return useMutation(
    orpc.jobs.refresh.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.jobs.key() }),
    }),
  );
}

export function useRankJobs() {
  const qc = useQueryClient();
  return useMutation(
    orpc.jobs.rank.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.jobs.key() }),
    }),
  );
}
