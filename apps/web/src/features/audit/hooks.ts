import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { auditApi } from "../../services/auditApi";

export function auditKeys() {
  return {
    all: ["audit"] as const,
    list: (organizationId?: string, filters?: Record<string, unknown>) =>
      ["audit", "list", organizationId, filters ?? {}] as const,
    timeline: (organizationId?: string, filters?: Record<string, unknown>) =>
      ["audit", "timeline", organizationId, filters ?? {}] as const,
    status: (organizationId?: string) => ["audit", "status", organizationId] as const,
  };
}

function toIsoFromLocal(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function useAuditEvents(
  organizationId?: string | null,
  filters?: Record<string, string | undefined>,
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: auditKeys().list(organizationId ?? undefined, filters),
    queryFn: async () => {
      const { data } = await auditApi.list({
        organizationId: organizationId ?? undefined,
        q: filters?.q || undefined,
        action: filters?.action || undefined,
        actorUserId: filters?.actorUserId || undefined,
        resourceType: filters?.resourceType || undefined,
        resourceId: filters?.resourceId || undefined,
        correlationId: filters?.correlationId || undefined,
        requestId: filters?.requestId || undefined,
        source: filters?.source || undefined,
        success: filters?.success || undefined,
        actorIp: filters?.actorIp || undefined,
        from: toIsoFromLocal(filters?.from),
        to: toIsoFromLocal(filters?.to),
        limit: 50,
        offset: 0,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useAuditTimeline(
  organizationId?: string | null,
  filters?: {
    correlationId?: string;
    requestId?: string;
    resourceType?: string;
    resourceId?: string;
  },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: auditKeys().timeline(organizationId ?? undefined, filters),
    queryFn: async () => {
      const { data } = await auditApi.timeline({
        organizationId: organizationId ?? undefined,
        correlationId: filters?.correlationId || undefined,
        requestId: filters?.requestId || undefined,
        resourceType: filters?.resourceType || undefined,
        resourceId: filters?.resourceId || undefined,
        limit: 200,
      });
      return data;
    },
    enabled: Boolean(
      accessToken &&
        organizationId &&
        enabled &&
        (filters?.correlationId ||
          filters?.requestId ||
          (filters?.resourceType && filters?.resourceId)),
    ),
  });
}

export function useAuditStatus(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: auditKeys().status(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await auditApi.status(organizationId ?? undefined);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useAuditExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await auditApi.export(body);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: auditKeys().status(
          typeof vars.organizationId === "string" ? vars.organizationId : undefined,
        ),
      });
    },
  });
}
