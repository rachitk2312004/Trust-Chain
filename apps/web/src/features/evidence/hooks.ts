import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { evidenceApi } from "../../services/evidenceApi";

export function evidenceKeys() {
  return {
    all: ["evidence"] as const,
    list: (organizationId?: string, filters?: Record<string, unknown>) =>
      ["evidence", "list", organizationId, filters ?? {}] as const,
    detail: (id?: string) => ["evidence", "detail", id] as const,
  };
}

export function useEvidenceList(
  organizationId?: string | null,
  filters?: { q?: string; status?: string; framework?: string },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: evidenceKeys().list(organizationId ?? undefined, filters),
    queryFn: async () => {
      const { data } = await evidenceApi.list({
        organizationId: organizationId!,
        q: filters?.q,
        status: filters?.status,
        framework: filters?.framework,
        limit: 50,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useEvidenceDetail(id?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: evidenceKeys().detail(id ?? undefined),
    queryFn: async () => {
      const { data } = await evidenceApi.get(id!);
      return data;
    },
    enabled: Boolean(accessToken && id && enabled),
  });
}

export function useCreateEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await evidenceApi.create(body);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: evidenceKeys().list(
          typeof vars.organizationId === "string" ? vars.organizationId : undefined,
        ),
      });
    },
  });
}

export function useLinkEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      targetType: string;
      targetId: string;
      label?: string;
    }) => {
      const { data } = await evidenceApi.link(input.id, {
        targetType: input.targetType,
        targetId: input.targetId,
        label: input.label,
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: evidenceKeys().detail(vars.id) });
    },
  });
}

export function useExportEvidence() {
  return useMutation({
    mutationFn: async (input: { organizationId: string; format?: "json" | "csv" }) => {
      const { data } = await evidenceApi.export(input);
      return data;
    },
  });
}

export function usePatchEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: Record<string, unknown> }) => {
      const { data } = await evidenceApi.patch(input.id, input.body);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: evidenceKeys().detail(vars.id) });
      void queryClient.invalidateQueries({ queryKey: evidenceKeys().all });
    },
  });
}
