import { z } from "zod";
import {
  OrgApprovalResourceTypeList,
  OrgApproverTypeList,
  OrgApprovalWorkflowStatuses,
  OrgPlatformDefaults,
  OrgUnitStatusList,
} from "@trustchain/config";

export const orgPlatformQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const createDepartmentBodySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(1).max(64).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  parentDepartmentId: z.string().uuid().optional().nullable(),
  businessUnitId: z.string().uuid().optional().nullable(),
  costCenterId: z.string().uuid().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(),
  policy: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(OrgUnitStatusList as [string, ...string[]]).optional(),
});

export const patchDepartmentBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  code: z.string().trim().min(1).max(64).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  parentDepartmentId: z.string().uuid().optional().nullable(),
  businessUnitId: z.string().uuid().optional().nullable(),
  costCenterId: z.string().uuid().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(),
  policy: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(OrgUnitStatusList as [string, ...string[]]).optional(),
});

export const departmentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createBusinessUnitBodySchema = z.object({
  organizationId: z.string().uuid(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  parentUnitId: z.string().uuid().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(),
  policy: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(OrgUnitStatusList as [string, ...string[]]).optional(),
  /// Optional cost center created with the BU
  costCenter: z
    .object({
      code: z.string().trim().min(1).max(64),
      name: z.string().trim().min(2).max(200),
      allocationPct: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

export const patchBusinessUnitBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  parentUnitId: z.string().uuid().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(),
  policy: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(OrgUnitStatusList as [string, ...string[]]).optional(),
});

export const businessUnitIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const hierarchyQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const createApprovalBodySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  resourceType: z.enum(OrgApprovalResourceTypeList as [string, ...string[]]),
  status: z.enum(Object.values(OrgApprovalWorkflowStatuses) as [string, ...string[]]).optional(),
  steps: z
    .array(
      z.object({
        stepOrder: z.number().int().min(1).max(OrgPlatformDefaults.maxApprovalSteps),
        approverType: z.enum(OrgApproverTypeList as [string, ...string[]]),
        approverRef: z.string().trim().min(1).max(200),
        name: z.string().trim().max(200).optional().nullable(),
      }),
    )
    .min(1)
    .max(OrgPlatformDefaults.maxApprovalSteps),
});
