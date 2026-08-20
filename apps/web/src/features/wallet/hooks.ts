import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { myCertificateApi } from "../../services/myCertificateApi";
import type { CertificateExportFormat } from "../../types/api";

export const myCertificateKeys = {
  all: ["my-certificates"] as const,
  list: (filters?: { status?: string }) => ["my-certificates", "list", filters ?? {}] as const,
  detail: (certificateId: string) => ["my-certificates", certificateId] as const,
};

export function useMyCertificates(filters?: { status?: string; limit?: number; offset?: number }) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: myCertificateKeys.list({ status: filters?.status }),
    queryFn: async () => {
      const { data } = await myCertificateApi.list(filters);
      return data;
    },
    enabled: Boolean(accessToken),
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useMyCertificate(certificateId: string | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: myCertificateKeys.detail(certificateId ?? ""),
    queryFn: async () => {
      const { data } = await myCertificateApi.get(certificateId!);
      return data.certificate;
    },
    enabled: Boolean(accessToken && certificateId),
  });
}

export function useMyCertificateDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { certificateId: string; format: CertificateExportFormat }) => {
      return myCertificateApi.download(input.certificateId, input.format);
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: myCertificateKeys.detail(variables.certificateId),
      });
    },
  });
}
