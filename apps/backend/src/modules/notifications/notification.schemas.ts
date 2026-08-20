import { z } from "zod";
import { SUPPORTED_NOTIFICATION_EVENTS } from "./notification.events.js";

export const notificationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  eventType: z.enum(SUPPORTED_NOTIFICATION_EVENTS as [string, ...string[]]).optional(),
  organizationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const historyQuerySchema = z.object({
  eventType: z.enum(SUPPORTED_NOTIFICATION_EVENTS as [string, ...string[]]).optional(),
  organizationId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const preferenceItemSchema = z.object({
  eventType: z.enum(SUPPORTED_NOTIFICATION_EVENTS as [string, ...string[]]),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  organizationId: z.string().uuid().nullable().optional(),
});

export const updatePreferencesBodySchema = z.object({
  preferences: z.array(preferenceItemSchema).min(1).max(50),
  emailDigestMode: z.enum(["immediate", "daily", "weekly"]).optional(),
});

export const adminListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const adminOutboxStatusQuerySchema = adminListQuerySchema.extend({
  status: z.enum([
    "pending",
    "processing",
    "retry",
    "failed",
    "sent",
    "delivered",
    "dead_letter",
    "skipped",
  ]),
});

export const retryDeadLettersBodySchema = z.object({
  ids: z.array(z.string().uuid()).max(200).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const retentionPurgeBodySchema = z.object({
  deletedNotificationDays: z.number().int().min(1).max(3650).optional(),
  terminalOutboxDays: z.number().int().min(1).max(3650).optional(),
});

export const outboxIdParamsSchema = z.object({
  id: z.string().uuid(),
});
