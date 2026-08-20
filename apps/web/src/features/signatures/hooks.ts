import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SignaturePolicyDefaults,
  SupportedSignatureAlgorithms,
} from "@trustchain/config";
import { useSessionStore } from "../../lib/sessionStore";
import { signatureApi } from "../../services/signatureApi";
import type {
  CreateSignatureApprovalWorkflowInput,
  SignCertificateInput,
  SignDetachedInput,
  SignDocumentInput,
  SignatureCreateInput,
  SignaturePolicyView,
  SignatureVerifyWorkflowInput,
} from "../../types/api";

export function signatureKeys(organizationId?: string, signatureId?: string) {
  return {
    all: ["signatures", organizationId] as const,
    list: (filters?: { status?: string; search?: string; documentId?: string }) =>
      ["signatures", organizationId, "list", filters ?? {}] as const,
    detail: ["signatures", organizationId, signatureId] as const,
    history: ["signatures", organizationId, signatureId, "history"] as const,
    policies: ["signatures", organizationId, "policies"] as const,
    workflows: (filters?: { status?: string }) =>
      ["signatures", organizationId, "workflows", filters ?? {}] as const,
    workflowDetail: (workflowId?: string) =>
      ["signatures", organizationId, "workflows", workflowId] as const,
    analytics: ["signatures", organizationId, "analytics"] as const,
  };
}

export function getDefaultSignaturePolicies(): SignaturePolicyView {
  return {
    defaultAlgorithm: SignaturePolicyDefaults.defaultAlgorithm,
    allowedAlgorithms: [...SignaturePolicyDefaults.allowedAlgorithms],
    maxExpirationDays: SignaturePolicyDefaults.maxExpirationDays,
    requireExpiration: SignaturePolicyDefaults.requireExpiration,
    defaultExpirationDays: SignaturePolicyDefaults.defaultExpirationDays,
    allowDetached: SignaturePolicyDefaults.allowDetached,
    allowDocumentSigning: SignaturePolicyDefaults.allowDocumentSigning,
    allowCertificateSigning: SignaturePolicyDefaults.allowCertificateSigning,
    allowRevokeBySigner: SignaturePolicyDefaults.allowRevokeBySigner,
    allowRevokeByAdmin: SignaturePolicyDefaults.allowRevokeByAdmin,
    signableDocumentStatuses: [...SignaturePolicyDefaults.signableDocumentStatuses],
    signableCertificateStatuses: [...SignaturePolicyDefaults.signableCertificateStatuses],
  };
}

export function useSignatures(
  organizationId: string | null | undefined,
  filters?: { status?: string; documentId?: string; limit?: number; offset?: number },
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: signatureKeys(organizationId ?? undefined).list({
      status: filters?.status,
      documentId: filters?.documentId,
    }),
    queryFn: async () => {
      const { data } = await signatureApi.list(organizationId!, {
        status: filters?.status || undefined,
        documentId: filters?.documentId || undefined,
        limit: filters?.limit,
        offset: filters?.offset,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useSignature(
  organizationId: string | null | undefined,
  signatureId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: signatureKeys(organizationId ?? undefined, signatureId).detail,
    queryFn: async () => {
      const { data } = await signatureApi.get(organizationId!, signatureId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && signatureId),
  });
}

export function useCreateSignature(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | ({ mode: "generic" } & Omit<SignatureCreateInput, "organizationId">)
        | ({ mode: "document" } & Omit<SignDocumentInput, "organizationId">)
        | ({ mode: "certificate" } & Omit<SignCertificateInput, "organizationId">),
    ) => {
      if (input.mode === "document") {
        const { mode: _mode, ...body } = input;
        const { data } = await signatureApi.signDocument({ ...body, organizationId });
        return data;
      }
      if (input.mode === "certificate") {
        const { mode: _mode, ...body } = input;
        const { data } = await signatureApi.signCertificate({ ...body, organizationId });
        return data;
      }
      const { mode: _mode, ...body } = input;
      const { data } = await signatureApi.create({ ...body, organizationId });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: signatureKeys(organizationId).all });
    },
  });
}

export function useVerifySignature(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (signatureId: string) => {
      const { data } = await signatureApi.verify(signatureId, { organizationId });
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId, result.signature.id).detail,
      });
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId, result.signature.id).history,
      });
      void queryClient.invalidateQueries({ queryKey: signatureKeys(organizationId).all });
    },
  });
}

export function useRevokeSignature(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { signatureId: string; reason?: string }) => {
      const { data } = await signatureApi.revoke(input.signatureId, {
        organizationId,
        reason: input.reason,
      });
      return data.signature;
    },
    onSuccess: (signature) => {
      void queryClient.invalidateQueries({ queryKey: signatureKeys(organizationId).all });
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId, signature.id).detail,
      });
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId, signature.id).history,
      });
    },
  });
}

export function useDetachedSignature(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | ({ action: "sign" } & Omit<SignDetachedInput, "organizationId">)
        | ({ action: "verify" } & Omit<SignatureVerifyWorkflowInput, "organizationId">),
    ) => {
      if (input.action === "sign") {
        const { action: _action, ...body } = input;
        const { data } = await signatureApi.signDetached({ ...body, organizationId });
        return { kind: "sign" as const, data };
      }
      const { action: _action, ...body } = input;
      const { data } = await signatureApi.verifyWorkflow({ ...body, organizationId });
      return { kind: "verify" as const, data };
    },
    onSuccess: (result) => {
      if (result.kind === "sign") {
        void queryClient.invalidateQueries({ queryKey: signatureKeys(organizationId).all });
      }
    },
  });
}

export function useSignatureHistory(
  organizationId: string | null | undefined,
  signatureId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: signatureKeys(organizationId ?? undefined, signatureId).history,
    queryFn: async () => {
      const { data } = await signatureApi.history(organizationId!, signatureId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && signatureId),
  });
}

export function useSignaturePolicies(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: signatureKeys(organizationId ?? undefined).policies,
    queryFn: async (): Promise<SignaturePolicyView> => getDefaultSignaturePolicies(),
    enabled: Boolean(organizationId),
    staleTime: Infinity,
  });
}

export function useSignatureWorkflows(
  organizationId: string | null | undefined,
  filters?: { status?: string; signatureId?: string; reviewerId?: string; limit?: number },
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: signatureKeys(organizationId ?? undefined).workflows({
      status: filters?.status,
    }),
    queryFn: async () => {
      const { data } = await signatureApi.listWorkflows(organizationId!, {
        status: filters?.status || undefined,
        signatureId: filters?.signatureId,
        reviewerId: filters?.reviewerId,
        limit: filters?.limit ?? 100,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useSignatureWorkflow(
  organizationId: string | null | undefined,
  workflowId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: signatureKeys(organizationId ?? undefined).workflowDetail(workflowId),
    queryFn: async () => {
      const { data } = await signatureApi.getWorkflow(organizationId!, workflowId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && workflowId),
  });
}

export function useCreateSignatureWorkflow(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateSignatureApprovalWorkflowInput, "organizationId">) => {
      const { data } = await signatureApi.createWorkflow({ ...input, organizationId });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId).workflows(),
      });
    },
  });
}

export function useApproveSignatureWorkflow(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { workflowId: string; comment?: string }) => {
      const { data } = await signatureApi.approveWorkflow(input.workflowId, {
        organizationId,
        comment: input.comment,
      });
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId).workflows(),
      });
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId).workflowDetail(result.workflow.id),
      });
    },
  });
}

export function useRejectSignatureWorkflow(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { workflowId: string; comment: string }) => {
      const { data } = await signatureApi.rejectWorkflow(input.workflowId, {
        organizationId,
        comment: input.comment,
      });
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId).workflows(),
      });
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId).workflowDetail(result.workflow.id),
      });
    },
  });
}

export function useCancelSignatureWorkflow(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { workflowId: string; reason?: string }) => {
      const { data } = await signatureApi.cancelWorkflow(input.workflowId, {
        organizationId,
        reason: input.reason,
      });
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId).workflows(),
      });
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId).workflowDetail(result.workflow.id),
      });
    },
  });
}

export function useSignatureAnalytics(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: signatureKeys(organizationId ?? undefined).analytics,
    queryFn: async () => {
      const { data } = await signatureApi.analytics(organizationId!);
      return data.analytics;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 30_000,
  });
}

export function useSignatureWorkflowAnalytics(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: [...signatureKeys(organizationId ?? undefined).analytics, "workflows"] as const,
    queryFn: async () => {
      const { data } = await signatureApi.analyticsWorkflows(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 30_000,
  });
}

export function useSignatureAlgorithmAnalytics(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: [...signatureKeys(organizationId ?? undefined).analytics, "algorithms"] as const,
    queryFn: async () => {
      const { data } = await signatureApi.analyticsAlgorithms(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 30_000,
  });
}

export function useSignatureVerificationAnalytics(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: [...signatureKeys(organizationId ?? undefined).analytics, "verifications"] as const,
    queryFn: async () => {
      const { data } = await signatureApi.analyticsVerifications(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 30_000,
  });
}

export function useSignatureDetachedAnalytics(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: [...signatureKeys(organizationId ?? undefined).analytics, "detached"] as const,
    queryFn: async () => {
      const { data } = await signatureApi.analyticsDetached(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 30_000,
  });
}

export function useAdminReprocessSignatures(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { signatureIds?: string[]; limit?: number }) => {
      const { data } = await signatureApi.adminReprocess(organizationId, input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId).analytics,
      });
      void queryClient.invalidateQueries({ queryKey: signatureKeys(organizationId).all });
    },
  });
}

export function useAdminCleanupSignatures(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input?: {
      eventDays?: number;
      approvalEventDays?: number;
      workflowDays?: number;
      artifactDays?: number;
      diagnosticEventDays?: number;
    }) => {
      const { data } = await signatureApi.adminCleanup(organizationId, input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: signatureKeys(organizationId).analytics,
      });
    },
  });
}

export const SUPPORTED_SIGNATURE_ALGORITHMS: string[] = [...SupportedSignatureAlgorithms];
