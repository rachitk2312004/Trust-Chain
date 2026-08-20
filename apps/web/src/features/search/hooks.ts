import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { searchApi } from "../../services/searchApi";

export function searchKeys() {
  return {
    all: ["search"] as const,
    results: (organizationId?: string, filters?: Record<string, unknown>) =>
      ["search", "results", organizationId, filters ?? {}] as const,
    suggestions: (organizationId?: string, q?: string) =>
      ["search", "suggestions", organizationId, q ?? ""] as const,
    status: (organizationId?: string) => ["search", "status", organizationId] as const,
  };
}

function toIsoFromLocal(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function useSearch(
  organizationId?: string | null,
  filters?: {
    q?: string;
    entityTypes?: string;
    status?: string;
    from?: string;
    to?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: searchKeys().results(organizationId ?? undefined, filters),
    queryFn: async () => {
      const { data } = await searchApi.search({
        organizationId: organizationId ?? undefined,
        q: filters?.q || undefined,
        entityTypes: filters?.entityTypes || undefined,
        status: filters?.status || undefined,
        from: toIsoFromLocal(filters?.from),
        to: toIsoFromLocal(filters?.to),
        sort: filters?.sort,
        limit: filters?.limit ?? 25,
        offset: filters?.offset ?? 0,
      });
      return data;
    },
    enabled: Boolean(accessToken && enabled && (organizationId || filters?.q)),
  });
}

export function useSearchSuggestions(
  organizationId?: string | null,
  q?: string,
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: searchKeys().suggestions(organizationId ?? undefined, q),
    queryFn: async () => {
      const { data } = await searchApi.suggestions({
        organizationId: organizationId ?? undefined,
        q: q!,
        limit: 8,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && q && q.length >= 1 && enabled),
  });
}

export function useSearchStatus(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: searchKeys().status(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await searchApi.status(organizationId ?? undefined);
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useReindexSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organizationId?: string; entityTypes?: string[] }) => {
      const { data } = await searchApi.reindex(input);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: searchKeys().status(vars.organizationId),
      });
      void queryClient.invalidateQueries({ queryKey: searchKeys().all });
    },
  });
}
