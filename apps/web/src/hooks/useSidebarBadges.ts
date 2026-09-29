import { useMemo } from "react";
import { useConversations } from "../features/messages/hooks";
import { useUnreadCounter } from "../features/notifications/hooks";
import { useOrganizationJoinRequests } from "../features/organizations/hooks";
import { useSupportSummary } from "../features/support/hooks";

export function useSidebarBadges(organizationId: string | null, showJoinRequests: boolean) {
  const unread = useUnreadCounter();
  const joinRequests = useOrganizationJoinRequests(
    organizationId ?? undefined,
    showJoinRequests && Boolean(organizationId),
  );
  const conversations = useConversations(organizationId);
  const support = useSupportSummary();

  return useMemo(() => {
    const pendingJoins = (joinRequests.data ?? []).filter((row) => row.status === "pending").length;
    const unreadMessages = (conversations.data ?? []).filter((row) => row.unread).length;
    return {
      notifications: unread.count,
      joinRequests: pendingJoins,
      messages: unreadMessages,
      inquiries: support.data?.inquiries ?? 0,
      bugs: support.data?.bugs ?? 0,
    };
  }, [conversations.data, joinRequests.data, support.data, unread.count]);
}
