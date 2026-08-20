import { z } from "zod";
import {
  SignatureApprovalWorkflowStatusList,
  SignatureApprovalWorkflowTypes,
} from "@trustchain/config";

export const workflowIdParamsSchema = z.object({
  workflowId: z.string().uuid(),
});

export const listWorkflowsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(SignatureApprovalWorkflowStatusList as [string, ...string[]]).optional(),
  signatureId: z.string().uuid().optional(),
  reviewerId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const reviewerAssignmentSchema = z.object({
  reviewerId: z.string().uuid(),
  /** 1-based step for sequential; ignored/normalized for parallel & threshold. */
  stepOrder: z.number().int().min(1).max(100).optional(),
});

export const createWorkflowBodySchema = z
  .object({
    organizationId: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    workflowType: z.enum([
      SignatureApprovalWorkflowTypes.sequential,
      SignatureApprovalWorkflowTypes.parallel,
      SignatureApprovalWorkflowTypes.threshold,
    ] as [string, ...string[]]),
    signatureId: z.string().uuid().nullable().optional(),
    thresholdCount: z.number().int().min(1).max(100).nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
    reviewers: z.array(reviewerAssignmentSchema).min(1).max(50),
  })
  .superRefine((body, ctx) => {
    if (body.workflowType === SignatureApprovalWorkflowTypes.threshold) {
      if (!body.thresholdCount || body.thresholdCount < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "thresholdCount is required for threshold workflows",
          path: ["thresholdCount"],
        });
      } else if (body.thresholdCount > body.reviewers.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "thresholdCount cannot exceed the number of reviewers",
          path: ["thresholdCount"],
        });
      }
    }
    const ids = body.reviewers.map((r) => r.reviewerId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate reviewers are not allowed",
        path: ["reviewers"],
      });
    }
  });

export const approveWorkflowBodySchema = z.object({
  organizationId: z.string().uuid(),
  comment: z.string().max(2000).optional(),
});

export const rejectWorkflowBodySchema = z.object({
  organizationId: z.string().uuid(),
  comment: z.string().min(1).max(2000),
});

export const cancelWorkflowBodySchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
});
