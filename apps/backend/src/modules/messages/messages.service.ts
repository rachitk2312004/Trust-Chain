import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { assertOrgFeature } from "../billing/billing.entitlements.js";
import { BillingFeatureKeys } from "../billing/billing.plans.js";
import {
  addHiddenIds,
  bumpInbox,
  cacheBackend,
  clearConversationAuth,
  filterVisibleMessages,
  getCachedInbox,
  getCachedThread,
  getConversationAuth,
  getHiddenIds,
  setHiddenIds,
  getInboxRev,
  getPresenceMap,
  getThreadHead,
  isOnline,
  laterIso,
  patchCachedThread,
  recordPostedMessage,
  setCachedInbox,
  setCachedThread,
  setConversationAuth,
  shouldServeThreadFromCache,
  touchPresence,
  type CachedChatMessage,
} from "./messages.cache.js";
import {
  canDeleteForEveryone,
  canMutateOwnMessage,
  ConversationTypes,
  dmMemberKey,
} from "./messages.schemas.js";

const STAFF_ROLES = [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee];

type MemberUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

function displayName(user: MemberUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email;
}

async function assertOrgStaff(userId: string, organizationId: string): Promise<void> {
  const allowed = await userHasRole(userId, STAFF_ROLES, organizationId);
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Organization staff role required");
}

async function loadConversation(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!conversation) throw new AppError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
  return conversation;
}

async function rememberConversationAuth(
  conversation: Awaited<ReturnType<typeof loadConversation>>,
): Promise<void> {
  await setConversationAuth(conversation.id, {
    organizationId: conversation.organizationId,
    memberIds: conversation.members.map((member) => member.userId),
  });
}

async function assertConversationAccess(userId: string, conversationId: string) {
  const cached = await getConversationAuth(conversationId);
  if (cached) {
    if (!cached.memberIds.includes(userId)) {
      throw new AppError(403, "FORBIDDEN", "You are not in this conversation");
    }
    await assertOrgStaff(userId, cached.organizationId);
    return cached;
  }
  const conversation = await loadConversation(conversationId);
  const membership = conversation.members.find((member) => member.userId === userId);
  if (!membership) throw new AppError(403, "FORBIDDEN", "You are not in this conversation");
  await assertOrgStaff(userId, conversation.organizationId);
  const auth = {
    organizationId: conversation.organizationId,
    memberIds: conversation.members.map((member) => member.userId),
  };
  await setConversationAuth(conversationId, auth);
  return auth;
}

async function assertConversationMember(userId: string, conversationId: string) {
  const conversation = await loadConversation(conversationId);
  const membership = conversation.members.find((member) => member.userId === userId);
  if (!membership) throw new AppError(403, "FORBIDDEN", "You are not in this conversation");
  await assertOrgStaff(userId, conversation.organizationId);
  await rememberConversationAuth(conversation);
  return { conversation, membership };
}

function publicMember(user: MemberUser) {
  return {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: displayName(user),
    lastSeenAt: null as string | null,
    online: false,
  };
}

function toPublicMessage(row: {
  id: string;
  conversationId: string;
  body: string;
  createdAt: Date;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  sender: MemberUser;
}): CachedChatMessage {
  const deleted = Boolean(row.deletedAt);
  return {
    id: row.id,
    conversationId: row.conversationId,
    body: deleted ? "" : row.body,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    sender: publicMember(row.sender),
  };
}

async function attachPresence<T extends { userId: string; lastSeenAt?: string | null; online?: boolean }>(
  members: T[],
): Promise<T[]> {
  if (!members.length) return members;
  const ids = members.map((member) => member.userId);
  const live = await getPresenceMap(ids);
  const devices = await prisma.device.findMany({
    where: { userId: { in: ids }, revokedAt: null },
    select: { userId: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
  });
  const deviceSeen = new Map<string, string>();
  for (const row of devices) {
    if (!deviceSeen.has(row.userId)) deviceSeen.set(row.userId, row.lastSeenAt.toISOString());
  }
  return members.map((member) => {
    const lastSeenAt = laterIso(live[member.userId], deviceSeen.get(member.userId) ?? null);
    return { ...member, lastSeenAt, online: isOnline(lastSeenAt) };
  });
}

async function assertStaffMembers(organizationId: string, actorId: string, memberIds: string[]) {
  const uniqueIds = [...new Set(memberIds.filter((id) => id !== actorId))];
  if (!uniqueIds.length) return uniqueIds;
  const staff = await prisma.roleBinding.findMany({
    where: {
      organizationId,
      userId: { in: uniqueIds },
      role: { key: { in: [RoleKeys.orgAdmin, RoleKeys.employee] } },
    },
    select: { userId: true },
  });
  const allowed = new Set(staff.map((row) => row.userId));
  if (uniqueIds.some((id) => !allowed.has(id))) {
    throw new AppError(400, "VALIDATION_ERROR", "Every member must belong to this organization");
  }
  const { directoryUserIdsForScope } = await import("../organizations/orgPlacement.js");
  const scopedIds = await directoryUserIdsForScope(actorId, organizationId);
  if (scopedIds && uniqueIds.some((id) => !scopedIds.has(id))) {
    throw new AppError(403, "FORBIDDEN", "You can only message staff in your branch");
  }
  return uniqueIds;
}

function conversationTitle(
  type: string,
  title: string | null,
  members: MemberUser[],
  viewerId: string,
): string {
  if (type === ConversationTypes.group) return title?.trim() || "Group chat";
  const other = members.find((member) => member.id !== viewerId) ?? members[0];
  return other ? displayName(other) : "Direct message";
}

export async function listDirectory(actorId: string, organizationId: string) {
  await assertOrgStaff(actorId, organizationId);
  await assertOrgFeature(actorId, organizationId, BillingFeatureKeys.messaging);
  const rows = await prisma.roleBinding.findMany({
    where: {
      organizationId,
      userId: { not: actorId },
      role: { key: { in: [RoleKeys.orgAdmin, RoleKeys.employee] } },
      user: { deletedAt: null, status: { not: "disabled" } },
    },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
    },
    orderBy: { user: { email: "asc" } },
  });

  const { directoryUserIdsForScope } = await import("../organizations/orgPlacement.js");
  const allowedIds = await directoryUserIdsForScope(actorId, organizationId);

  const seen = new Set<string>();
  const members = [];
  for (const row of rows) {
    if (allowedIds && !allowedIds.has(row.userId)) continue;
    if (seen.has(row.userId)) continue;
    seen.add(row.userId);
    members.push({
      ...publicMember(row.user),
      status: row.user.status,
      title: null,
    });
  }

  return { members: await attachPresence(members) };
}

export async function listConversations(actorId: string, organizationId: string) {
  await assertOrgStaff(actorId, organizationId);
  await assertOrgFeature(actorId, organizationId, BillingFeatureKeys.messaging);
  const cached = await getCachedInbox(organizationId, actorId);
  if (cached) {
    const conversations = await Promise.all(
      (cached.conversations as Array<{ members?: Array<{ userId: string }> }>).map(async (row) => ({
        ...row,
        members: await attachPresence(row.members ?? []),
      })),
    );
    return { conversations };
  }

  const rows = await prisma.conversation.findMany({
    where: {
      organizationId,
      members: { some: { userId: actorId } },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
      messages: {
        where: {
          deletedAt: null,
          hides: { none: { userId: actorId } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
  });

  const conversations = rows.map((row) => {
    const members = row.members.map((member) => member.user);
    const self = row.members.find((member) => member.userId === actorId);
    const last = row.messages[0] ?? null;
    const unread =
      last && last.senderId !== actorId
        ? !self?.lastReadAt || last.createdAt > self.lastReadAt
        : false;
    return {
      id: row.id,
      organizationId: row.organizationId,
      type: row.type,
      title: conversationTitle(row.type, row.title, members, actorId),
      createdById: row.createdById,
      members: members.map(publicMember),
      lastMessage: last ? toPublicMessage(last) : null,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      unread,
      createdAt: row.createdAt.toISOString(),
    };
  });
  const withPresence = await Promise.all(
    conversations.map(async (row) => ({
      ...row,
      members: await attachPresence(row.members),
    })),
  );
  await setCachedInbox(organizationId, actorId, withPresence);
  return { conversations: withPresence };
}

export async function createConversation(
  actorId: string,
  input: {
    organizationId: string;
    type: "dm" | "group";
    title?: string;
    memberIds: string[];
  },
) {
  await assertOrgStaff(actorId, input.organizationId);
  await assertOrgFeature(actorId, input.organizationId, BillingFeatureKeys.messaging);
  const uniqueIds = [...new Set(input.memberIds.filter((id) => id !== actorId))];
  if (!uniqueIds.length) {
    throw new AppError(400, "VALIDATION_ERROR", "Select at least one other person");
  }
  if (input.type === ConversationTypes.dm && uniqueIds.length !== 1) {
    throw new AppError(400, "VALIDATION_ERROR", "Direct messages require exactly one other member");
  }

  const staff = await prisma.roleBinding.findMany({
    where: {
      organizationId: input.organizationId,
      userId: { in: uniqueIds },
      role: { key: { in: [RoleKeys.orgAdmin, RoleKeys.employee] } },
    },
    select: { userId: true },
  });
  const allowed = new Set(staff.map((row) => row.userId));
  if (uniqueIds.some((id) => !allowed.has(id))) {
    throw new AppError(400, "VALIDATION_ERROR", "Every member must belong to this organization");
  }
  const { directoryUserIdsForScope } = await import("../organizations/orgPlacement.js");
  const scopedIds = await directoryUserIdsForScope(actorId, input.organizationId);
  if (scopedIds && uniqueIds.some((id) => !scopedIds.has(id))) {
    throw new AppError(403, "FORBIDDEN", "You can only message staff in your branch");
  }

  if (input.type === ConversationTypes.dm) {
    const otherId = uniqueIds[0];
    if (!otherId) {
      throw new AppError(400, "VALIDATION_ERROR", "Direct messages require exactly one other member");
    }
    const existing = await prisma.conversation.findMany({
      where: {
        organizationId: input.organizationId,
        type: ConversationTypes.dm,
        AND: [
          { members: { some: { userId: actorId } } },
          { members: { some: { userId: otherId } } },
        ],
      },
      include: { members: true },
    });
    const match = existing.find((row) => {
      const ids = row.members.map((member) => member.userId).sort().join(":");
      return ids === dmMemberKey(actorId, otherId);
    });
    if (match) {
      return getConversation(actorId, match.id);
    }
  }

  const created = await prisma.conversation.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      title: input.type === ConversationTypes.group ? input.title?.trim() ?? "Group chat" : null,
      createdById: actorId,
      members: {
        create: [actorId, ...uniqueIds].map((userId) => ({ userId })),
      },
    },
  });

  await bumpInbox(input.organizationId, [actorId, ...uniqueIds]);
  return getConversation(actorId, created.id);
}

export async function getConversation(actorId: string, conversationId: string) {
  const { conversation } = await assertConversationMember(actorId, conversationId);
  const members = conversation.members.map((member) => member.user);
  return {
    conversation: {
      id: conversation.id,
      organizationId: conversation.organizationId,
      type: conversation.type,
      createdById: conversation.createdById,
      title: conversationTitle(conversation.type, conversation.title, members, actorId),
      members: await attachPresence(members.map(publicMember)),
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      createdAt: conversation.createdAt.toISOString(),
    },
  };
}

export async function listMessages(
  actorId: string,
  conversationId: string,
  query: { after?: string; limit: number },
) {
  await assertConversationAccess(actorId, conversationId);
  let hiddenIds = await getHiddenIds(actorId, conversationId);
  if (hiddenIds == null) {
    const rows = await prisma.chatMessageHide.findMany({
      where: { userId: actorId, message: { conversationId } },
      select: { messageId: true },
    });
    hiddenIds = rows.map((row) => row.messageId);
    await setHiddenIds(actorId, conversationId, hiddenIds);
  }
  if (shouldServeThreadFromCache(query)) {
    const cached = await getCachedThread(conversationId);
    if (cached) {
      return { messages: filterVisibleMessages(cached, hiddenIds).slice(-query.limit) };
    }
  }

  const after = query.after
    ? await prisma.chatMessage.findFirst({
        where: { id: query.after, conversationId },
        select: { createdAt: true },
      })
    : null;

  const rows = await prisma.chatMessage.findMany({
    where: {
      conversationId,
      ...(after ? { createdAt: { gt: after.createdAt } } : {}),
    },
    include: {
      sender: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
    take: query.limit,
  });

  const messages = rows.map((row) => toPublicMessage(row));
  if (shouldServeThreadFromCache(query)) {
    await setCachedThread(conversationId, messages);
  }
  return { messages: filterVisibleMessages(messages, hiddenIds) };
}

export async function sendMessage(actorId: string, conversationId: string, body: string) {
  const { conversation } = await assertConversationMember(actorId, conversationId);
  await assertOrgFeature(actorId, conversation.organizationId, BillingFeatureKeys.messaging);
  const created = await prisma.chatMessage.create({
    data: { conversationId, senderId: actorId, body },
    include: {
      sender: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: created.createdAt },
  });
  await prisma.conversationMember.updateMany({
    where: { conversationId, userId: actorId },
    data: { lastReadAt: created.createdAt },
  });

  const message = toPublicMessage(created);
  await recordPostedMessage({
    organizationId: conversation.organizationId,
    conversationId,
    memberIds: conversation.members.map((member) => member.userId),
    message,
  });
  return { message };
}

export async function markConversationRead(actorId: string, conversationId: string) {
  const { conversation } = await assertConversationMember(actorId, conversationId);
  await prisma.conversationMember.updateMany({
    where: { conversationId, userId: actorId },
    data: { lastReadAt: new Date() },
  });
  await bumpInbox(conversation.organizationId, [actorId]);
  return { ok: true };
}

export async function syncInbox(
  actorId: string,
  organizationId: string,
  conversationId?: string,
) {
  await assertOrgStaff(actorId, organizationId);
  await assertOrgFeature(actorId, organizationId, BillingFeatureKeys.messaging);
  await touchPresence(actorId);
  const [inboxRev, threadHead, backend] = await Promise.all([
    getInboxRev(organizationId, actorId),
    conversationId ? getThreadHead(conversationId) : Promise.resolve(null),
    cacheBackend(),
  ]);
  return {
    inboxRev: inboxRev ?? 0,
    threadHead,
    backend,
  };
}

export async function editMessage(
  actorId: string,
  conversationId: string,
  messageId: string,
  body: string,
) {
  const { conversation } = await assertConversationMember(actorId, conversationId);
  const existing = await prisma.chatMessage.findFirst({
    where: { id: messageId, conversationId },
    include: { sender: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  if (!existing) throw new AppError(404, "MESSAGE_NOT_FOUND", "Message not found");
  if (!canMutateOwnMessage(actorId, existing.senderId, existing.deletedAt)) {
    throw new AppError(403, "FORBIDDEN", "You can only edit your own messages");
  }
  const updated = await prisma.chatMessage.update({
    where: { id: existing.id },
    data: { body, editedAt: new Date() },
    include: { sender: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  const message = toPublicMessage(updated);
  await patchCachedThread(conversationId, (rows) =>
    rows.map((row) => (row.id === message.id ? message : row)),
  );
  await bumpInbox(
    conversation.organizationId,
    conversation.members.map((member) => member.userId),
  );
  return { message };
}

export async function deleteMessages(
  actorId: string,
  conversationId: string,
  messageIds: string[],
  scope: "me" | "all",
) {
  const { conversation } = await assertConversationMember(actorId, conversationId);
  const uniqueIds = [...new Set(messageIds)];
  const existing = await prisma.chatMessage.findMany({
    where: { conversationId, id: { in: uniqueIds } },
    include: { sender: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  if (existing.length !== uniqueIds.length) {
    throw new AppError(404, "MESSAGE_NOT_FOUND", "One or more messages were not found");
  }

  if (scope === "me") {
    await prisma.chatMessageHide.createMany({
      data: uniqueIds.map((messageId) => ({ messageId, userId: actorId })),
      skipDuplicates: true,
    });
    await addHiddenIds(actorId, conversationId, uniqueIds);
    await bumpInbox(conversation.organizationId, [actorId]);
    return { scope, hiddenIds: uniqueIds, messages: [] as CachedChatMessage[] };
  }

  for (const row of existing) {
    if (!canDeleteForEveryone(actorId, row.senderId, row.deletedAt)) {
      throw new AppError(403, "FORBIDDEN", "You can only delete your own messages for everyone");
    }
  }
  const now = new Date();
  await prisma.chatMessage.updateMany({
    where: { id: { in: uniqueIds }, conversationId },
    data: { deletedAt: now, body: "" },
  });
  const messages = existing.map((row) =>
    toPublicMessage({ ...row, body: "", deletedAt: now }),
  );
  await patchCachedThread(conversationId, (rows) =>
    rows.map((row) => messages.find((item) => item.id === row.id) ?? row),
  );
  await bumpInbox(
    conversation.organizationId,
    conversation.members.map((member) => member.userId),
  );
  return { scope, hiddenIds: [] as string[], messages };
}

export async function addConversationMembers(
  actorId: string,
  conversationId: string,
  memberIds: string[],
) {
  const { conversation } = await assertConversationMember(actorId, conversationId);
  if (conversation.type !== ConversationTypes.group) {
    throw new AppError(400, "VALIDATION_ERROR", "Only group chats can add members");
  }
  const uniqueIds = await assertStaffMembers(conversation.organizationId, actorId, memberIds);
  const existing = new Set(conversation.members.map((member) => member.userId));
  const toAdd = uniqueIds.filter((id) => !existing.has(id));
  if (!toAdd.length) return getConversation(actorId, conversationId);
  await prisma.conversationMember.createMany({
    data: toAdd.map((userId) => ({ conversationId, userId })),
    skipDuplicates: true,
  });
  await clearConversationAuth(conversationId);
  await bumpInbox(conversation.organizationId, [
    ...conversation.members.map((member) => member.userId),
    ...toAdd,
  ]);
  return getConversation(actorId, conversationId);
}

export async function removeConversationMember(
  actorId: string,
  conversationId: string,
  userId: string,
) {
  const { conversation } = await assertConversationMember(actorId, conversationId);
  if (conversation.type !== ConversationTypes.group) {
    throw new AppError(400, "VALIDATION_ERROR", "Only group chats can remove members");
  }
  if (!conversation.members.some((member) => member.userId === userId)) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "That person is not in this group");
  }
  const remaining = conversation.members.filter((member) => member.userId !== userId);
  if (!remaining.length) {
    throw new AppError(400, "VALIDATION_ERROR", "A group needs at least one member");
  }
  await prisma.conversationMember.deleteMany({ where: { conversationId, userId } });
  await clearConversationAuth(conversationId);
  await bumpInbox(
    conversation.organizationId,
    conversation.members.map((member) => member.userId),
  );
  if (userId === actorId) {
    return { conversation: null, left: true };
  }
  return { ...await getConversation(actorId, conversationId), left: false };
}
