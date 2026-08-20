import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { certificateApi } from "../../services/certificateApi";
import { myCertificateKeys } from "../wallet/hooks";
import type {
  CertificateBulkPreviewInput,
  CertificateBulkStartInput,
  CertificateExportFormat,
  CreateCertificateTemplateInput,
  IssueCertificateInput,
  UpdateCertificateTemplateInput,
} from "../../types/api";

export function certificateKeys(organizationId?: string, certificateId?: string) {
  return {
    all: ["certificates", organizationId] as const,
    list: (filters?: { status?: string; search?: string }) =>
      ["certificates", organizationId, "list", filters ?? {}] as const,
    detail: ["certificates", organizationId, certificateId] as const,
    history: ["certificates", organizationId, certificateId, "history"] as const,
    templates: ["certificates", organizationId, "templates"] as const,
    preview: (id: string) => ["certificates", organizationId, id, "preview"] as const,
    download: (id: string, format: string) =>
      ["certificates", organizationId, id, "download", format] as const,
    bulkJob: (jobId: string) => ["certificates", organizationId, "bulk", jobId] as const,
    analytics: ["certificates", organizationId, "analytics"] as const,
  };
}

export function useCertificates(
  organizationId: string | null | undefined,
  filters?: { status?: string; limit?: number; offset?: number },
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: certificateKeys(organizationId ?? undefined).list({
      status: filters?.status,
    }),
    queryFn: async () => {
      const { data } = await certificateApi.list(organizationId!, {
        status: filters?.status || undefined,
        limit: filters?.limit,
        offset: filters?.offset,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 60_000,
  });
}

export function useCertificate(
  organizationId: string | null | undefined,
  certificateId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: certificateKeys(organizationId ?? undefined, certificateId).detail,
    queryFn: async () => {
      const { data } = await certificateApi.get(organizationId!, certificateId!);
      return data.certificate;
    },
    enabled: Boolean(accessToken && organizationId && certificateId),
    staleTime: 2 * 60_000,
  });
}

export function useCertificateTemplates(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: certificateKeys(organizationId ?? undefined).templates,
    queryFn: async () => {
      const { data } = await certificateApi.listTemplates(organizationId!);
      return data.templates;
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useCreateCertificate(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<IssueCertificateInput, "organizationId">) => {
      const { data } = await certificateApi.issue({ ...input, organizationId });
      return data.certificate;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: certificateKeys(organizationId).all });
      void queryClient.invalidateQueries({ queryKey: myCertificateKeys.all });
    },
  });
}

export function useCreateTemplate(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateCertificateTemplateInput, "organizationId">) => {
      const { data } = await certificateApi.createTemplate({ ...input, organizationId });
      return data.template;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: certificateKeys(organizationId).templates });
    },
  });
}

export function useUpdateTemplate(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { templateId: string } & UpdateCertificateTemplateInput) => {
      const { templateId, ...body } = input;
      const { data } = await certificateApi.updateTemplate(organizationId, templateId, body);
      return data.template;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: certificateKeys(organizationId).templates });
    },
  });
}

export function useVerifyCertificate(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (certificateId: string) => {
      const { data } = await certificateApi.verify(certificateId, { organizationId });
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: certificateKeys(organizationId, result.certificate.id).detail,
      });
      void queryClient.invalidateQueries({
        queryKey: certificateKeys(organizationId, result.certificate.id).history,
      });
    },
  });
}

export function useRevokeCertificate(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { certificateId: string; reason?: string }) => {
      const { data } = await certificateApi.revoke(input.certificateId, {
        organizationId,
        reason: input.reason,
      });
      return data.certificate;
    },
    onSuccess: (certificate) => {
      void queryClient.invalidateQueries({ queryKey: certificateKeys(organizationId).all });
      void queryClient.invalidateQueries({
        queryKey: certificateKeys(organizationId, certificate.id).detail,
      });
      void queryClient.invalidateQueries({
        queryKey: certificateKeys(organizationId, certificate.id).history,
      });
    },
  });
}

export function useCertificateHistory(
  organizationId: string | null | undefined,
  certificateId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: certificateKeys(organizationId ?? undefined, certificateId).history,
    queryFn: async () => {
      const { data } = await certificateApi.history(organizationId!, certificateId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && certificateId),
    staleTime: 60_000,
  });
}

export function useCertificatePreview(
  organizationId: string | null | undefined,
  certificateId: string | undefined,
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: certificateKeys(organizationId ?? undefined, certificateId).preview(
      certificateId ?? "",
    ),
    queryFn: async () => {
      const result = await certificateApi.download(organizationId!, certificateId!, "png");
      const url = URL.createObjectURL(result.blob);
      return { url, warnings: result.warnings, fileName: result.fileName };
    },
    enabled: Boolean(accessToken && organizationId && certificateId && enabled),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });
}

export function useCertificateDownload(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      certificateId: string;
      format: CertificateExportFormat;
      publicId?: string;
    }) => {
      const cacheKey = certificateKeys(organizationId, input.certificateId).download(
        input.certificateId,
        input.format,
      );
      const cached = queryClient.getQueryData<Awaited<ReturnType<typeof certificateApi.download>>>(
        cacheKey,
      );
      if (cached) return cached;
      const result = await certificateApi.download(
        organizationId,
        input.certificateId,
        input.format,
        input.publicId,
      );
      queryClient.setQueryData(cacheKey, result);
      return result;
    },
  });
}

export function usePreviewCertificateBulk(organizationId: string) {
  return useMutation({
    mutationFn: async (input: Omit<CertificateBulkPreviewInput, "organizationId">) => {
      const { data } = await certificateApi.previewBulk({ ...input, organizationId });
      return data.preview;
    },
  });
}

export function useStartCertificateBulk(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CertificateBulkStartInput, "organizationId">) => {
      const { data } = await certificateApi.startBulk({ ...input, organizationId });
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: certificateKeys(organizationId).all });
      queryClient.setQueryData(certificateKeys(organizationId).bulkJob(data.job.jobId), data.job);
    },
  });
}

export function useCertificateBulkJob(
  organizationId: string | null | undefined,
  jobId: string | undefined,
  options?: { refetchInterval?: number | false },
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: certificateKeys(organizationId ?? undefined).bulkJob(jobId ?? ""),
    queryFn: async () => {
      const { data } = await certificateApi.getBulkJob(organizationId!, jobId!);
      return data.job;
    },
    enabled: Boolean(accessToken && organizationId && jobId),
    refetchInterval: (query) => {
      if (options?.refetchInterval === false) return false;
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed" || status === "cancelled") return false;
      return options?.refetchInterval ?? 1500;
    },
  });
}

export function useCancelCertificateBulk(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data } = await certificateApi.cancelBulkJob(organizationId, jobId);
      return data.job;
    },
    onSuccess: (job) => {
      queryClient.setQueryData(certificateKeys(organizationId).bulkJob(job.jobId), job);
      void queryClient.invalidateQueries({ queryKey: certificateKeys(organizationId).all });
    },
  });
}

export function useCertificateAnalytics(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: certificateKeys(organizationId ?? undefined).analytics,
    queryFn: async () => {
      const { data } = await certificateApi.analytics(organizationId!);
      return data.analytics;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 30_000,
  });
}

export function useCertificateTemplateAnalytics(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: [...certificateKeys(organizationId ?? undefined).analytics, "templates"] as const,
    queryFn: async () => {
      const { data } = await certificateApi.analyticsTemplates(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 30_000,
  });
}

export function useCertificateDownloadAnalytics(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: [...certificateKeys(organizationId ?? undefined).analytics, "downloads"] as const,
    queryFn: async () => {
      const { data } = await certificateApi.analyticsDownloads(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 30_000,
  });
}

export function useAdminReprocessCertificates(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input?: {
      certificateIds?: string[];
      limit?: number;
      renderFormat?: "pdf" | "png" | "svg";
      skipRender?: boolean;
    }) => {
      const { data } = await certificateApi.adminReprocess(organizationId, input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: certificateKeys(organizationId).analytics,
      });
    },
  });
}

export function useAdminCleanupCertificates(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input?: {
      eventDays?: number;
      bulkJobDays?: number;
      temporaryAssetEventDays?: number;
    }) => {
      const { data } = await certificateApi.adminCleanup(organizationId, input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: certificateKeys(organizationId).analytics,
      });
    },
  });
}
