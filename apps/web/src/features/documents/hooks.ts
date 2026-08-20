import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentApi } from "../../services/documentApi";
import type {
  ConfirmVersionInput,
  CreateDocumentInput,
  CreateShareInput,
  ListDocumentsParams,
  UploadUrlInput,
} from "../../services/documentApi";
import { putFileToPresignedUrl, sha256Hex } from "../../lib/fileHash";
import { validateLocalFile } from "../../lib/docErrors";
import { useSessionStore } from "../../lib/sessionStore";
import type { DocumentPermission } from "../../types/api";

export function docKeys(organizationId?: string, documentId?: string) {
  return {
    all: ["documents", organizationId] as const,
    list: (params?: ListDocumentsParams) => ["documents", organizationId, "list", params] as const,
    search: (q: string) => ["documents", organizationId, "search", q] as const,
    detail: ["documents", organizationId, documentId] as const,
    versions: ["documents", organizationId, documentId, "versions"] as const,
    shares: ["documents", organizationId, documentId, "shares"] as const,
    history: ["documents", organizationId, documentId, "history"] as const,
    categories: ["documents", organizationId, "categories"] as const,
    tags: ["documents", organizationId, "tags"] as const,
    policies: ["documents", organizationId, documentId, "policies"] as const,
  };
}

export function useDocuments(organizationId: string | null | undefined, params?: ListDocumentsParams) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: docKeys(organizationId ?? undefined).list(params),
    queryFn: async () => {
      const { data } = await documentApi.list(organizationId!, params);
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 60_000,
  });
}

export function useSearchDocuments(
  organizationId: string | null | undefined,
  q: string,
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const trimmed = q.trim();
  return useQuery({
    queryKey: docKeys(organizationId ?? undefined).search(trimmed),
    queryFn: async () => {
      const { data } = await documentApi.list(organizationId!, { q: trimmed, limit: 50, offset: 0 });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled && trimmed.length > 0),
  });
}

export function useDocument(
  organizationId: string | null | undefined,
  documentId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: docKeys(organizationId ?? undefined, documentId).detail,
    queryFn: async () => {
      const { data } = await documentApi.get(organizationId!, documentId!);
      return data.document;
    },
    enabled: Boolean(accessToken && organizationId && documentId),
    staleTime: 2 * 60_000,
  });
}

export function useUploadDocument(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title?: string;
      description?: string;
      file: File;
      documentId?: string;
      activate?: boolean;
    }) => {
      const localError = validateLocalFile(input.file);
      if (localError) throw new Error(localError);

      let documentId = input.documentId;
      if (!documentId) {
        const created = await documentApi.create(organizationId, {
          title: input.title?.trim() || input.file.name,
          description: input.description,
        } satisfies CreateDocumentInput);
        documentId = created.data.document.id;
      }

      const mimeType = input.file.type;
      const uploadBody: UploadUrlInput = {
        mimeType,
        originalFileName: input.file.name,
        expectedSizeBytes: input.file.size,
      };
      const { data: upload } = await documentApi.createUploadUrl(
        organizationId,
        documentId,
        uploadBody,
      );

      await putFileToPresignedUrl(upload.uploadUrl, input.file, mimeType);
      const contentHash = await sha256Hex(input.file);

      const confirmBody: ConfirmVersionInput = {
        uploadSessionId: upload.uploadSession.id,
        contentHash,
        mimeType,
        sizeBytes: input.file.size,
        originalFileName: input.file.name,
        activate: input.activate ?? true,
      };
      const { data: confirmed } = await documentApi.confirmVersion(
        organizationId,
        documentId,
        confirmBody,
      );
      return confirmed;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: docKeys(organizationId).all });
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, result.document.id).detail,
      });
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, result.document.id).versions,
      });
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, result.document.id).history,
      });
    },
  });
}

export function useConfirmUpload(organizationId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ConfirmVersionInput) => {
      const { data } = await documentApi.confirmVersion(organizationId, documentId, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: docKeys(organizationId).all });
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, documentId).detail,
      });
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, documentId).versions,
      });
    },
  });
}

export function useArchiveDocument(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data } = await documentApi.archive(organizationId, documentId);
      return data.document;
    },
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: docKeys(organizationId, documentId).detail });
      const previous = queryClient.getQueryData(docKeys(organizationId, documentId).detail);
      queryClient.setQueryData(docKeys(organizationId, documentId).detail, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        return { ...old, status: "archived", archivedAt: new Date().toISOString() };
      });
      return { previous, documentId };
    },
    onError: (_err, documentId, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(docKeys(organizationId, documentId).detail, ctx.previous);
      }
    },
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: docKeys(organizationId).all });
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, document.id).detail,
      });
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, document.id).history,
      });
    },
  });
}

export function useRestoreDocument(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data } = await documentApi.restore(organizationId, documentId);
      return data.document;
    },
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: docKeys(organizationId, documentId).detail });
      const previous = queryClient.getQueryData(docKeys(organizationId, documentId).detail);
      queryClient.setQueryData(docKeys(organizationId, documentId).detail, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        return { ...old, status: "active", archivedAt: null };
      });
      return { previous, documentId };
    },
    onError: (_err, documentId, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(docKeys(organizationId, documentId).detail, ctx.previous);
      }
    },
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: docKeys(organizationId).all });
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, document.id).detail,
      });
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, document.id).history,
      });
    },
  });
}

export function useDocumentVersions(
  organizationId: string | null | undefined,
  documentId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: docKeys(organizationId ?? undefined, documentId).versions,
    queryFn: async () => {
      const { data } = await documentApi.listVersions(organizationId!, documentId!);
      return data.versions;
    },
    enabled: Boolean(accessToken && organizationId && documentId),
    staleTime: 60_000,
  });
}

export function useShareDocument(organizationId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateShareInput) => {
      const { data } = await documentApi.createShare(organizationId, documentId, body);
      return data.share;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, documentId).shares,
      });
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, documentId).history,
      });
    },
  });
}

export function useDocumentShares(
  organizationId: string | null | undefined,
  documentId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: docKeys(organizationId ?? undefined, documentId).shares,
    queryFn: async () => {
      const { data } = await documentApi.listShares(organizationId!, documentId!);
      return data.shares;
    },
    enabled: Boolean(accessToken && organizationId && documentId),
    staleTime: 60_000,
  });
}

export function useRevokeShare(organizationId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { data } = await documentApi.revokeShare(organizationId, documentId, shareId);
      return data.share;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: docKeys(organizationId, documentId).shares,
      });
    },
  });
}

export function useDocumentHistory(
  organizationId: string | null | undefined,
  documentId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: docKeys(organizationId ?? undefined, documentId).history,
    queryFn: async () => {
      const { data } = await documentApi.listAudit(organizationId!, documentId!);
      return data.entries;
    },
    enabled: Boolean(accessToken && organizationId && documentId),
    staleTime: 60_000,
  });
}

export function useDocumentCategories(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: docKeys(organizationId ?? undefined).categories,
    queryFn: async () => {
      const { data } = await documentApi.listCategories(organizationId!);
      return data.categories;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 5 * 60_000,
  });
}

export function useCreateCategory(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description?: string | null }) => {
      const { data } = await documentApi.createCategory(organizationId, body);
      return data.category;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: docKeys(organizationId).categories });
    },
  });
}

export function useDocumentTags(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: docKeys(organizationId ?? undefined).tags,
    queryFn: async () => {
      const { data } = await documentApi.listTags(organizationId!);
      return data.tags;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 5 * 60_000,
  });
}

export function useCreateTag(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string }) => {
      const { data } = await documentApi.createTag(organizationId, body);
      return data.tag;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: docKeys(organizationId).tags });
    },
  });
}

export function useUpdateDocument(organizationId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      title?: string;
      description?: string | null;
      categoryId?: string | null;
      tagIds?: string[];
      status?: "draft" | "active";
    }) => {
      const { data } = await documentApi.update(organizationId, documentId, body);
      return data.document;
    },
    onSuccess: (document) => {
      queryClient.setQueryData(docKeys(organizationId, documentId).detail, document);
      void queryClient.invalidateQueries({ queryKey: docKeys(organizationId).all });
    },
  });
}

export function useUpdateDocumentExpiration(organizationId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expiresAt: string | null) => {
      const { data } = await documentApi.updateExpiration(organizationId, documentId, expiresAt);
      return data.document;
    },
    onSuccess: (document) => {
      queryClient.setQueryData(docKeys(organizationId, documentId).detail, document);
    },
  });
}

export function useDocumentAccessPolicies(
  organizationId: string | null | undefined,
  documentId: string | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: docKeys(organizationId ?? undefined, documentId).policies,
    queryFn: async () => {
      const { data } = await documentApi.listAccessPolicies(organizationId!, documentId!);
      return data.policies;
    },
    enabled: Boolean(accessToken && organizationId && documentId),
  });
}

export function usePutDocumentAccessPolicies(organizationId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      policies: Array<{
        subjectType: "user" | "role" | "organization";
        subjectId: string;
        permission: DocumentPermission;
      }>,
    ) => {
      const { data } = await documentApi.putAccessPolicies(organizationId, documentId, policies);
      return data.policies;
    },
    onSuccess: (policies) => {
      queryClient.setQueryData(docKeys(organizationId, documentId).policies, policies);
    },
  });
}

export function useDownloadDocument(organizationId: string) {
  return useMutation({
    mutationFn: async (input: { documentId: string; fileName: string; versionId?: string }) => {
      const { downloadDocumentFile } = await import("../../lib/downloadDocument");
      await downloadDocumentFile(
        organizationId,
        input.documentId,
        input.fileName,
        input.versionId,
      );
    },
  });
}
