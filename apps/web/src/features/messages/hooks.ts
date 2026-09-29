import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { messageApi } from "../../services/messageApi";
import { useSessionStore } from "../../lib/sessionStore";
import type { ChatConversationSummary, ChatMessage } from "../../types/api";

export function messageKeys(organizationId?: string, conversationId?: string) {
  return {
    all: ["messages", organizationId] as const,
    sync: ["messages", organizationId, "sync"] as const,
    directory: ["messages", organizationId, "directory"] as const,
    list: ["messages", organizationId, "conversations"] as const,
    thread: ["messages", organizationId, conversationId, "thread"] as const,
  };
}

export function useMessageSync(
  organizationId: string | null | undefined,
  conversationId?: string | null,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: [...messageKeys(organizationId ?? undefined).sync, conversationId ?? "inbox"],
    queryFn: async () => {
      const { data } = await messageApi.sync(organizationId!, conversationId ?? undefined);
      return data;
    },
    enabled: Boolean(accessToken && organizationId),
    refetchInterval: 2_000,
    staleTime: 1_000,
  });
}

export function useMessageDirectory(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: messageKeys(organizationId ?? undefined).directory,
    queryFn: async () => {
      const { data } = await messageApi.directory(organizationId!);
      return data.members;
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

function useRefetchOnChange(value: string | number | null | undefined, refetch: () => void) {
  const previous = useRef<typeof value>(value);
  useEffect(() => {
    if (previous.current === value) return;
    if (previous.current != null && value != null) {
      refetch();
    }
    previous.current = value;
  }, [value, refetch]);
}

export function useConversations(organizationId: string | null | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const sync = useMessageSync(organizationId);
  const query = useQuery({
    queryKey: messageKeys(organizationId ?? undefined).list,
    queryFn: async () => {
      const { data } = await messageApi.listConversations(organizationId!);
      return data.conversations;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  useRefetchOnChange(sync.data?.inboxRev, () => {
    void queryClient.invalidateQueries({
      queryKey: messageKeys(organizationId ?? undefined).list,
    });
  });

  return query;
}

export function useConversationMessages(
  organizationId: string | null | undefined,
  conversationId: string | null | undefined,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const sync = useMessageSync(organizationId, conversationId);
  const query = useQuery({
    queryKey: messageKeys(organizationId ?? undefined, conversationId ?? undefined).thread,
    queryFn: async () => {
      const { data } = await messageApi.listMessages(conversationId!, { limit: 80 });
      return data.messages;
    },
    enabled: Boolean(accessToken && organizationId && conversationId),
    staleTime: 15_000,
    placeholderData: (previous, previousQuery) => {
      const previousConversationId = previousQuery?.queryKey[2];
      return previousConversationId === conversationId ? previous : undefined;
    },
    refetchOnWindowFocus: false,
  });

  useRefetchOnChange(`${sync.data?.inboxRev ?? 0}:${sync.data?.threadHead ?? ""}`, () => {
    void queryClient.invalidateQueries({
      queryKey: messageKeys(organizationId ?? undefined, conversationId ?? undefined).thread,
    });
  });

  return query;
}

export function useCreateConversation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: "dm" | "group"; title?: string; memberIds: string[] }) => {
      const { data } = await messageApi.createConversation({ organizationId, ...input });
      return data.conversation;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys(organizationId).list });
    },
  });
}

export function useSendMessage(organizationId: string, conversationId: string) {
  const queryClient = useQueryClient();
  const self = useSessionStore((s) => s.user);

  return useMutation({
    mutationFn: async (body: string) => {
      const { data } = await messageApi.sendMessage(conversationId, body);
      return data.message;
    },
    onMutate: async (body) => {
      const threadKey = messageKeys(organizationId, conversationId).thread;
      const listKey = messageKeys(organizationId).list;
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previousThread = queryClient.getQueryData<ChatMessage[]>(threadKey);
      const previousList = queryClient.getQueryData<ChatConversationSummary[]>(listKey);
      const sender = {
        userId: self?.id ?? "me",
        email: self?.email ?? "",
        firstName: self?.firstName ?? null,
        lastName: self?.lastName ?? null,
        name: [self?.firstName, self?.lastName].filter(Boolean).join(" ").trim() || self?.email || "You",
      };
      const optimistic: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversationId,
        body,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        sender,
      };
      queryClient.setQueryData<ChatMessage[]>(threadKey, (current) => [
        ...(current ?? []),
        optimistic,
      ]);
      queryClient.setQueryData<ChatConversationSummary[]>(listKey, (current) =>
        (current ?? []).map((item) =>
          item.id === conversationId
            ? {
                ...item,
                lastMessage: {
                  id: optimistic.id,
                  body: optimistic.body,
                  createdAt: optimistic.createdAt,
                  sender,
                },
                lastMessageAt: optimistic.createdAt,
                unread: false,
              }
            : item,
        ),
      );
      return { previousThread, previousList, threadKey, listKey };
    },
    onError: (_error, _body, context) => {
      if (!context) return;
      queryClient.setQueryData(context.threadKey, context.previousThread);
      queryClient.setQueryData(context.listKey, context.previousList);
    },
    onSuccess: (message, _body, context) => {
      if (!context) return;
      queryClient.setQueryData<ChatMessage[]>(context.threadKey, (current) => {
        const withoutTemp = (current ?? []).filter((item) => !item.id.startsWith("temp-"));
        if (withoutTemp.some((item) => item.id === message.id)) return withoutTemp;
        return [...withoutTemp, message];
      });
      queryClient.setQueryData<ChatConversationSummary[]>(context.listKey, (current) =>
        (current ?? []).map((item) =>
          item.id === conversationId
            ? {
                ...item,
                lastMessage: {
                  id: message.id,
                  body: message.body,
                  createdAt: message.createdAt,
                  sender: message.sender,
                },
                lastMessageAt: message.createdAt,
                unread: false,
              }
            : item,
        ),
      );
    },
  });
}

export function useEditMessage(organizationId: string, conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { messageId: string; body: string }) => {
      const { data } = await messageApi.editMessage(conversationId, input.messageId, input.body);
      return data.message;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessage[]>(
        messageKeys(organizationId, conversationId).thread,
        (current) => (current ?? []).map((item) => (item.id === message.id ? message : item)),
      );
    },
  });
}

export function useDeleteMessages(organizationId: string, conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { messageIds: string[]; scope: "me" | "all" }) => {
      const { data } = await messageApi.deleteMessages(conversationId, input);
      return data;
    },
    onSuccess: (result) => {
      const threadKey = messageKeys(organizationId, conversationId).thread;
      queryClient.setQueryData<ChatMessage[]>(threadKey, (current) => {
        const rows = current ?? [];
        if (result.scope === "me") {
          const hidden = new Set(result.hiddenIds);
          return rows.filter((item) => !hidden.has(item.id));
        }
        return rows.map((item) => result.messages.find((updated) => updated.id === item.id) ?? item);
      });
      void queryClient.invalidateQueries({ queryKey: messageKeys(organizationId).list });
    },
  });
}

export function useAddConversationMembers(organizationId: string, conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberIds: string[]) => {
      const { data } = await messageApi.addMembers(conversationId, memberIds);
      return data.conversation;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys(organizationId).list });
    },
  });
}

export function useRemoveConversationMember(organizationId: string, conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await messageApi.removeMember(conversationId, userId);
      return data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: messageKeys(organizationId).list });
      if (result.left) {
        void queryClient.invalidateQueries({ queryKey: messageKeys(organizationId).all });
      }
    },
  });
}

export function useMarkConversationRead(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      await messageApi.markRead(conversationId);
      return conversationId;
    },
    onSuccess: (conversationId) => {
      queryClient.setQueryData<ChatConversationSummary[]>(
        messageKeys(organizationId).list,
        (current) =>
          (current ?? []).map((item) =>
            item.id === conversationId ? { ...item, unread: false } : item,
          ),
      );
    },
  });
}
