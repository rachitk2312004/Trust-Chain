import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sha256Hex } from "../../lib/fileHash";
import { validateLocalFile } from "../../lib/docErrors";
import {
  extractPublicLinkToken,
  isSha256Hex,
} from "../../lib/verifyErrors";
import { useSessionStore } from "../../lib/sessionStore";
import {
  verificationApi,
  type ListVerificationsParams,
  type PublicVerifyBody,
  type StartVerifyInput,
} from "../../services/verificationApi";
import type { VerificationStatistics } from "../../types/api";

export function verifyKeys(organizationId?: string, verificationId?: string) {
  return {
    all: ["verifications", organizationId] as const,
    list: (params?: ListVerificationsParams) =>
      ["verifications", organizationId, "list", params] as const,
    detail: ["verifications", organizationId, verificationId] as const,
    stats: ["verifications", organizationId, "stats"] as const,
    documentHistory: (documentId: string) =>
      ["verifications", organizationId, "document", documentId] as const,
  };
}

function aggregateStats(
  items: Array<{ outcome: string | null; request: { status: string } }>,
): VerificationStatistics {
  const byOutcome: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const item of items) {
    const outcome = item.outcome ?? "unknown";
    byOutcome[outcome] = (byOutcome[outcome] ?? 0) + 1;
    byStatus[item.request.status] = (byStatus[item.request.status] ?? 0) + 1;
  }
  const total = items.length;
  const valid = byOutcome.valid ?? 0;
  return {
    total,
    byOutcome,
    byStatus,
    validRate: total ? Math.round((valid / total) * 100) : 0,
  };
}

export function useVerificationHistory(
  organizationId: string | null | undefined,
  params?: ListVerificationsParams,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: verifyKeys(organizationId ?? undefined).list(params),
    queryFn: async () => {
      const { data } = await verificationApi.list(organizationId!, params);
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useVerification(
  organizationId: string | null | undefined,
  verificationId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: verifyKeys(organizationId ?? undefined, verificationId).detail,
    queryFn: async () => {
      const { data } = await verificationApi.get(organizationId!, verificationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && verificationId),
  });
}

export function useVerificationStatistics(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: verifyKeys(organizationId ?? undefined).stats,
    queryFn: async () => {
      const { data } = await verificationApi.list(organizationId!, { limit: 100, offset: 0 });
      return aggregateStats(data.verifications);
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useVerifyHash(organizationId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      contentHash: string;
      documentId?: string;
      mode?: "public" | "organization";
    }) => {
      const hash = input.contentHash.trim().toLowerCase();
      if (!isSha256Hex(hash)) {
        throw new Error("Invalid hash. Provide a 64-character SHA-256 hex digest.");
      }
      if (input.mode === "organization" || (input.documentId && organizationId)) {
        if (!organizationId || !input.documentId) {
          throw new Error("Organization and document are required for organization hash verify.");
        }
        const { data } = await verificationApi.verifyDocument(organizationId, input.documentId, {
          mode: "sync",
          expectedContentHash: hash,
          requireAnchor: true,
        } satisfies StartVerifyInput);
        return { kind: "organization" as const, data };
      }
      const { data } = await verificationApi.publicByHash(hash);
      return { kind: "public" as const, data: data.report };
    },
    onSuccess: () => {
      if (organizationId) {
        void queryClient.invalidateQueries({ queryKey: verifyKeys(organizationId).all });
      }
    },
  });
}

export function useVerifyFile(organizationId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      documentId?: string;
      rehashFromR2?: boolean;
    }) => {
      const localError = validateLocalFile(input.file);
      if (localError) throw new Error(localError);
      const contentHash = await sha256Hex(input.file);

      if (input.documentId && organizationId) {
        const { data } = await verificationApi.verifyDocument(organizationId, input.documentId, {
          mode: "sync",
          expectedContentHash: contentHash,
          rehashFromR2: Boolean(input.rehashFromR2),
          requireAnchor: true,
        });
        return { kind: "organization" as const, contentHash, data };
      }

      const { data } = await verificationApi.publicByHash(contentHash);
      return { kind: "public" as const, contentHash, data: data.report };
    },
    onSuccess: () => {
      if (organizationId) {
        void queryClient.invalidateQueries({ queryKey: verifyKeys(organizationId).all });
      }
    },
  });
}

export function useVerifyIdentifier() {
  return useMutation({
    mutationFn: async (input: {
      type: "verificationCode" | "publicVerifyCode" | "transactionHash" | "documentPublicCode";
      value: string;
    }) => {
      const value = input.value.trim();
      if (!value) throw new Error("Identifier is required.");
      if (input.type === "verificationCode") {
        const { data } = await verificationApi.publicByCode(value);
        return data.report;
      }
      if (input.type === "publicVerifyCode" || input.type === "documentPublicCode") {
        const { data } = await verificationApi.publicByDocumentCode(value);
        return data.report;
      }
      const { data } = await verificationApi.publicByTx(value);
      return data.report;
    },
  });
}

export function usePublicVerification() {
  return useMutation({
    mutationFn: async (
      input:
        | { kind: "body"; body: PublicVerifyBody }
        | { kind: "hash"; hash: string }
        | { kind: "code"; code: string }
        | { kind: "tx"; transactionHash: string }
        | { kind: "document"; publicVerifyCode: string }
        | { kind: "link"; tokenOrUrl: string }
        | { kind: "qr"; payload: string },
    ) => {
      switch (input.kind) {
        case "body": {
          const { data } = await verificationApi.publicVerify(input.body);
          return data.report;
        }
        case "hash": {
          const { data } = await verificationApi.publicByHash(input.hash.trim());
          return data.report;
        }
        case "code": {
          const { data } = await verificationApi.publicByCode(input.code.trim());
          return data.report;
        }
        case "tx": {
          const { data } = await verificationApi.publicByTx(input.transactionHash.trim());
          return data.report;
        }
        case "document": {
          const { data } = await verificationApi.publicByDocumentCode(
            input.publicVerifyCode.trim(),
          );
          return data.report;
        }
        case "link":
        case "qr": {
          const token = extractPublicLinkToken(input.kind === "link" ? input.tokenOrUrl : input.payload);
          if (!token) throw new Error("Invalid QR or link payload.");
          const { data } = await verificationApi.publicByLinkToken(token);
          return data.report;
        }
        default:
          throw new Error("Unsupported public verification lookup.");
      }
    },
  });
}

export function useStartDocumentVerification(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { documentId: string } & StartVerifyInput) => {
      const { documentId, ...body } = input;
      const { data } = await verificationApi.verifyDocument(organizationId, documentId, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: verifyKeys(organizationId).all });
    },
  });
}

export { aggregateStats };
