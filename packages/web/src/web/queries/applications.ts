import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { authClient } from "../lib/auth";

export function useApplications(status: "all" | "drafted" | "needs_review" | "submitted_manually" | "failed" | "skipped" = "all") {
  const { data: session } = authClient.useSession();
  return useQuery(
    orpc.applications.list.queryOptions({ input: { status }, enabled: !!session, staleTime: 5_000 }),
  );
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: orpc.applications.key() });
  qc.invalidateQueries({ queryKey: orpc.jobs.key() });
}

export function useDraftApplication() {
  const qc = useQueryClient();
  return useMutation(orpc.applications.draft.mutationOptions({ onSuccess: () => invalidateAll(qc) }));
}

export function useDraftBatch() {
  const qc = useQueryClient();
  return useMutation(orpc.applications.draftBatch.mutationOptions({ onSuccess: () => invalidateAll(qc) }));
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation(orpc.applications.update.mutationOptions({ onSuccess: () => invalidateAll(qc) }));
}

export function useAutofill(jobId: number, enabled: boolean) {
  return useQuery(
    orpc.applications.autofill.queryOptions({ input: { jobId }, enabled, staleTime: 30_000, retry: false }),
  );
}
