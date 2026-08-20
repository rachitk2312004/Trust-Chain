import { z } from "zod";
import {
  AuditDefaults,
  AuditEventSourceList,
  AuditExportFormatList,
} from "@trustchain/config";

const optionalUuid = z.string().uuid().optional();
const optionalBool = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

export const auditListQuerySchema = z.object({
  organizationId: optionalUuid,
  q: z.string().trim().min(1).max(200).optional(),
  action: z.string().trim().min(1).max(128).optional(),
  actorUserId: optionalUuid,
  resourceType: z.string().trim().min(1).max(64).optional(),
  resourceId: z.string().trim().min(1).max(128).optional(),
  correlationId: z.string().trim().min(1).max(128).optional(),
  requestId: z.string().trim().min(1).max(128).optional(),
  source: z.enum(AuditEventSourceList as [string, ...string[]]).optional(),
  success: optionalBool,
  actorIp: z.string().trim().min(1).max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(AuditDefaults.maxLimit)
    .default(AuditDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const auditIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const auditTimelineQuerySchema = z.object({
  organizationId: optionalUuid,
  correlationId: z.string().trim().min(1).max(128).optional(),
  requestId: z.string().trim().min(1).max(128).optional(),
  resourceType: z.string().trim().min(1).max(64).optional(),
  resourceId: z.string().trim().min(1).max(128).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(AuditDefaults.timelineLimit)
    .default(AuditDefaults.timelineLimit),
});

export const auditExportBodySchema = z.object({
  organizationId: optionalUuid,
  format: z.enum(AuditExportFormatList as [string, ...string[]]).default("json"),
  q: z.string().trim().min(1).max(200).optional(),
  action: z.string().trim().min(1).max(128).optional(),
  actorUserId: optionalUuid,
  resourceType: z.string().trim().min(1).max(64).optional(),
  resourceId: z.string().trim().min(1).max(128).optional(),
  correlationId: z.string().trim().min(1).max(128).optional(),
  requestId: z.string().trim().min(1).max(128).optional(),
  source: z.enum(AuditEventSourceList as [string, ...string[]]).optional(),
  success: z.boolean().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const auditStatusQuerySchema = z.object({
  organizationId: optionalUuid,
});
