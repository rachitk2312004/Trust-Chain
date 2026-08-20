import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { extractQrScanToken } from "../../lib/qrErrors";
import { useSessionStore } from "../../lib/sessionStore";
import { qrApi } from "../../services/qrApi";
import type { CreateQrInput, CreateQrTemplateInput } from "../../types/api";

export function qrKeys(organizationId?: string, publicCode?: string) {
  return {
    all: ["qr", organizationId] as const,
    list: ["qr", organizationId, "list"] as const,
    detail: ["qr", organizationId, publicCode] as const,
    templates: ["qr", organizationId, "templates"] as const,
    analytics: ["qr", organizationId, "analytics"] as const,
    events: ["qr", organizationId, "events"] as const,
    preview: (code: string, format: string) =>
      ["qr", organizationId, code, "preview", format] as const,
    download: (code: string, format: string) =>
      ["qr", organizationId, code, "download", format] as const,
  };
}

export function useQrCodes(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: qrKeys(organizationId ?? undefined).list,
    queryFn: async () => {
      const { data } = await qrApi.list(organizationId!);
      return data.qrs;
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useQrCode(
  organizationId: string | null | undefined,
  publicCode: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: qrKeys(organizationId ?? undefined, publicCode).detail,
    queryFn: async () => {
      const { data } = await qrApi.get(organizationId!, publicCode!);
      return data.qr;
    },
    enabled: Boolean(accessToken && organizationId && publicCode),
  });
}

export function useQrTemplates(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: qrKeys(organizationId ?? undefined).templates,
    queryFn: async () => {
      const { data } = await qrApi.listTemplates(organizationId!);
      return data.templates;
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useCreateQr(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { documentId: string } & CreateQrInput) => {
      const { documentId, ...body } = input;
      const { data } = await qrApi.create(organizationId, documentId, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qrKeys(organizationId).all });
    },
  });
}

/** Rotate QR (nearest update API). */
export function useUpdateQr(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { publicCode: string } & Partial<CreateQrInput>) => {
      const { publicCode, ...body } = input;
      const { data } = await qrApi.rotate(organizationId, publicCode, body);
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: qrKeys(organizationId).all });
      void queryClient.invalidateQueries({
        queryKey: qrKeys(organizationId, result.qr.publicCode).detail,
      });
    },
  });
}

/** Soft-delete via disable (no hard-delete endpoint). */
export function useDeleteQr(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (publicCode: string) => {
      const { data } = await qrApi.disable(organizationId, publicCode);
      return data.qr;
    },
    onSuccess: (qr) => {
      void queryClient.invalidateQueries({ queryKey: qrKeys(organizationId).all });
      void queryClient.invalidateQueries({
        queryKey: qrKeys(organizationId, qr.publicCode).detail,
      });
    },
  });
}

export function useRevokeQr(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (publicCode: string) => {
      const { data } = await qrApi.revoke(organizationId, publicCode);
      return data.qr;
    },
    onSuccess: (qr) => {
      void queryClient.invalidateQueries({ queryKey: qrKeys(organizationId).all });
      void queryClient.invalidateQueries({
        queryKey: qrKeys(organizationId, qr.publicCode).detail,
      });
      void queryClient.invalidateQueries({ queryKey: qrKeys(organizationId).events });
    },
  });
}

export function useQrAnalytics(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: qrKeys(organizationId ?? undefined).analytics,
    queryFn: async () => {
      const { data } = await qrApi.analytics(organizationId!);
      return data.analytics;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useQrEvents(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: qrKeys(organizationId ?? undefined).events,
    queryFn: async () => {
      const { data } = await qrApi.events(organizationId!);
      return data.events;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 2 * 60_000,
  });
}

async function fetchQrDownload(
  organizationId: string,
  publicCode: string,
  format: "png" | "svg" | "base64",
) {
  const response = await qrApi.download(organizationId, publicCode, format);
  if (format === "base64") {
    const body = response.data as unknown as { pngBase64: string };
    return { format, pngBase64: body.pngBase64, blob: null as Blob | null };
  }
  const contentType = format === "svg" ? "image/svg+xml" : "image/png";
  const blob = new Blob([response.data as ArrayBuffer], { type: contentType });
  return { format, pngBase64: null as string | null, blob };
}

/** Cached QR preview (base64). Avoids repeated download calls on remount. */
export function useQrPreview(
  organizationId: string | null | undefined,
  publicCode: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: qrKeys(organizationId ?? undefined, publicCode).preview(publicCode ?? "", "base64"),
    queryFn: async () => {
      const result = await fetchQrDownload(organizationId!, publicCode!, "base64");
      return result.pngBase64 ? `data:image/png;base64,${result.pngBase64}` : null;
    },
    enabled: Boolean(accessToken && organizationId && publicCode),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useDownloadQr(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      publicCode: string;
      format?: "png" | "svg" | "base64";
    }) => {
      const format = input.format ?? "png";
      const cacheKey = qrKeys(organizationId, input.publicCode).download(input.publicCode, format);
      const cached = queryClient.getQueryData<Awaited<ReturnType<typeof fetchQrDownload>>>(cacheKey);
      if (cached) return cached;
      const result = await fetchQrDownload(organizationId, input.publicCode, format);
      queryClient.setQueryData(cacheKey, result);
      if (format === "base64" && result.pngBase64) {
        queryClient.setQueryData(
          qrKeys(organizationId, input.publicCode).preview(input.publicCode, "base64"),
          `data:image/png;base64,${result.pngBase64}`,
        );
      }
      return result;
    },
  });
}

export function useCreateQrTemplate(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateQrTemplateInput) => {
      const { data } = await qrApi.createTemplate(organizationId, body);
      return data.template;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qrKeys(organizationId).templates });
    },
  });
}

export function usePublicQrScan() {
  return useMutation({
    mutationFn: async (tokenOrUrl: string) => {
      const token = extractQrScanToken(tokenOrUrl);
      if (!token) throw new Error("Invalid QR scan token.");
      const { data } = await qrApi.publicScan(token);
      return data;
    },
  });
}
