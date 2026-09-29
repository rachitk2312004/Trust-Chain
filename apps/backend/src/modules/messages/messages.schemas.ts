import { z } from "zod";

export const ConversationTypes = {
  dm: "dm",
  group: "group",
} as const;

export const organizationIdQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const syncInboxQuerySchema = z.object({
  organizationId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
});

export const listMessagesQuerySchema = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const conversationIdParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

export const messageIdParamsSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});

export const memberUserParamsSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const addMembersBodySchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(40),
});

export const createConversationBodySchema = z
  .object({
    organizationId: z.string().uuid(),
    type: z.enum([ConversationTypes.dm, ConversationTypes.group]),
    title: z.string().trim().min(1).max(120).optional(),
    memberIds: z.array(z.string().uuid()).min(1).max(40),
  })
  .superRefine((value, ctx) => {
    if (value.type === ConversationTypes.dm && value.memberIds.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Direct messages require exactly one other member",
        path: ["memberIds"],
      });
    }
    if (value.type === ConversationTypes.group && !value.title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Group chats require a title",
        path: ["title"],
      });
    }
  });

export const sendMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const editMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const deleteMessagesBodySchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1).max(80),
  scope: z.enum(["me", "all"]),
});

export function canMutateOwnMessage(actorId: string, senderId: string, deletedAt?: Date | null): boolean {
  return actorId === senderId && !deletedAt;
}

export function canDeleteForEveryone(actorId: string, senderId: string, deletedAt?: Date | null): boolean {
  return canMutateOwnMessage(actorId, senderId, deletedAt);
}

export function dmMemberKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}
