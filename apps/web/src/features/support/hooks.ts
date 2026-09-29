import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supportApi } from "../../services/supportApi";
import { useSessionStore } from "../../lib/sessionStore";

export function supportKeys() {
  return {
    summary: ["support", "summary"] as const,
    inquiries: ["support", "inquiries"] as const,
    inquiry: (id?: string) => ["support", "inquiry", id] as const,
    bugs: ["support", "bugs"] as const,
    bug: (id?: string) => ["support", "bug", id] as const,
    bugImage: (id?: string) => ["support", "bug-image", id] as const,
  };
}

export function useSupportSummary(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: supportKeys().summary,
    queryFn: async () => {
      const { data } = await supportApi.summary();
      return data;
    },
    enabled: Boolean(accessToken) && enabled,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

export function useInquiries(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: supportKeys().inquiries,
    queryFn: async () => {
      const { data } = await supportApi.listInquiries();
      return data.inquiries;
    },
    enabled: Boolean(accessToken) && enabled,
    refetchInterval: 8_000,
  });
}

export function useInquiry(inquiryId: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: supportKeys().inquiry(inquiryId ?? undefined),
    queryFn: async () => {
      const { data } = await supportApi.getInquiry(inquiryId!);
      return data.inquiry;
    },
    enabled: Boolean(accessToken && inquiryId) && enabled,
    refetchInterval: 6_000,
  });
}

export function useCreateInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { subject: string; body: string; organizationId?: string }) => {
      const { data } = await supportApi.createInquiry(body);
      return data.inquiry;
    },
    onSuccess: (inquiry) => {
      void queryClient.invalidateQueries({ queryKey: supportKeys().inquiries });
      void queryClient.invalidateQueries({ queryKey: supportKeys().summary });
      queryClient.setQueryData(supportKeys().inquiry(inquiry.id), inquiry);
    },
  });
}

export function useReplyInquiry(inquiryId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data } = await supportApi.replyInquiry(inquiryId!, body);
      return data.inquiry;
    },
    onSuccess: (inquiry) => {
      queryClient.setQueryData(supportKeys().inquiry(inquiry.id), inquiry);
      void queryClient.invalidateQueries({ queryKey: supportKeys().inquiries });
      void queryClient.invalidateQueries({ queryKey: supportKeys().summary });
    },
  });
}

export function useCloseInquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inquiryId: string) => {
      const { data } = await supportApi.closeInquiry(inquiryId);
      return data.inquiry;
    },
    onSuccess: (inquiry) => {
      queryClient.setQueryData(supportKeys().inquiry(inquiry.id), inquiry);
      void queryClient.invalidateQueries({ queryKey: supportKeys().inquiries });
      void queryClient.invalidateQueries({ queryKey: supportKeys().summary });
    },
  });
}

export function useBugs(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: supportKeys().bugs,
    queryFn: async () => {
      const { data } = await supportApi.listBugs();
      return data.bugs;
    },
    enabled: Boolean(accessToken) && enabled,
    refetchInterval: 10_000,
  });
}

export function useBug(bugId: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: supportKeys().bug(bugId ?? undefined),
    queryFn: async () => {
      const { data } = await supportApi.getBug(bugId!);
      return data.bug;
    },
    enabled: Boolean(accessToken && bugId) && enabled,
    refetchInterval: 8_000,
  });
}

export function useBugImage(bugId: string | null, hasImage: boolean) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !bugId || !hasImage) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void supportApi.bugImage(bugId).then(({ data }) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(data);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, bugId, hasImage]);

  return url;
}

export function useCreateBug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      title: string;
      description: string;
      organizationId?: string;
      imageBase64?: string;
      imageContentType?: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    }) => {
      const { data } = await supportApi.createBug(body);
      return data.bug;
    },
    onSuccess: (bug) => {
      queryClient.setQueryData(supportKeys().bug(bug.id), bug);
      void queryClient.invalidateQueries({ queryKey: supportKeys().bugs });
      void queryClient.invalidateQueries({ queryKey: supportKeys().summary });
    },
  });
}

export function useRespondToBug(bugId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { body: string; status?: string }) => {
      const { data } = await supportApi.respondToBug(bugId!, body);
      return data.bug;
    },
    onSuccess: (bug) => {
      queryClient.setQueryData(supportKeys().bug(bug.id), bug);
      void queryClient.invalidateQueries({ queryKey: supportKeys().bugs });
      void queryClient.invalidateQueries({ queryKey: supportKeys().summary });
    },
  });
}

export function useCommentOnBug(bugId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data } = await supportApi.commentOnBug(bugId!, body);
      return data.bug;
    },
    onSuccess: (bug) => {
      queryClient.setQueryData(supportKeys().bug(bug.id), bug);
      void queryClient.invalidateQueries({ queryKey: supportKeys().bugs });
    },
  });
}
