import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "../lib/api";
import { authClient } from "../lib/auth";

export function useProfile() {
  const { data: session } = authClient.useSession();
  return useQuery(orpc.profile.get.queryOptions({ enabled: !!session, staleTime: 15_000 }));
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation(
    orpc.profile.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.profile.key() }),
    }),
  );
}

export function useAnalyzeProfile() {
  const qc = useQueryClient();
  return useMutation(
    orpc.profile.analyze.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.profile.key() }),
    }),
  );
}

/** Presign → PUT straight to storage → parse to text server-side. */
export function useUploadResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const { url, key } = await client.profile.presignResume({
        filename: file.name,
        contentType: file.type || "application/pdf",
      });
      const put = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/pdf" },
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      return client.profile.attachResume({ key, filename: file.name });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: orpc.profile.key() }),
  });
}
