import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireOrgMember } from "../../middleware/requireRole.js";
import {
  createOrganizationBodySchema,
  organizationIdParamsSchema,
  updateOrganizationBodySchema,
} from "./organizations.schemas.js";
import {
  createOrganizationForUser,
  getOrganizationForUser,
  getOrganizationOverviewForUser,
  listUserOrganizations,
  getOrganizationWorkspaceContext,
  patchOrganizationForUser,
} from "./organizations.service.js";
import {
  acceptInvitation,
  createOrgBranch,
  createOrgDepartment,
  inviteToOrganization,
  listOrgBranches,
  listOrgDepartments,
  listOrgInvitations,
  listOrgMembers,
  patchOrgBranch,
  patchOrgDepartment,
  patchOrgMember,
  removeOrgBranch,
  removeOrgDepartment,
} from "./orgStructure.service.js";
import { createLogoUploadUrl, getOrgBranding, updateOrgBranding } from "./branding.service.js";
import { getBulkImportJob, runBulkImport } from "./bulkImport.service.js";
import {
  approveJoinRequest,
  createJoinRequest,
  discoverOrganizations,
  listMyJoinRequests,
  listOrgJoinRequests,
  rejectJoinRequest,
  updateOrgMemberRole,
} from "./joinRequests.service.js";
import { documentsRouter } from "../documents/documents.router.js";
import { organizationBlockchainRouter } from "../blockchain/blockchain.router.js";
import { organizationVerificationRouter } from "../verification/routes/verification.router.js";
import { organizationPublicVerificationRouter } from "../public-verification/routes/publicVerification.router.js";
import { organizationQrRouter } from "../qr/routes/qr.router.js";
import { organizationAiRouter } from "../ai/routes/ai.router.js";

export const organizationsRouter = Router();

organizationsRouter.use(requireAuth);

organizationsRouter.get(
  "/discover",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const organizations = await discoverOrganizations(req.user.id, q);
    res.status(200).json({ organizations });
  }),
);

organizationsRouter.get(
  "/join-requests/mine",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const requests = await listMyJoinRequests(req.user.id);
    res.status(200).json({ requests });
  }),
);

organizationsRouter.post(
  "/:id/join-requests",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(
      z.object({
        message: z.string().max(500).optional(),
        requestedRole: z.enum(["employee", "public_user"]).optional(),
      }),
      req.body,
    );
    const request = await createJoinRequest(req.user.id, params.id, body);
    res.status(201).json({ request });
  }),
);

organizationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createOrganizationBodySchema, req.body);
    const organization = await createOrganizationForUser(req.user.id, body);
    res.status(201).json({ organization });
  }),
);

organizationsRouter.get(
  "/workspace-context",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const context = await getOrganizationWorkspaceContext(req.user.id);
    res.status(200).json(context);
  }),
);

organizationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const organizations = await listUserOrganizations(req.user.id);
    res.status(200).json({ organizations });
  }),
);

/** Central RBAC: auth → org membership → org REST, then nested module routers */
organizationsRouter.use("/:id", requireOrgMember);

organizationsRouter.get(
  "/:id/overview",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const data = await getOrganizationOverviewForUser(
      params.id,
      req.roleBindings ?? [],
    );
    res.status(200).json(data);
  }),
);

organizationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const organization = await getOrganizationForUser(req.user.id, params.id);
    res.status(200).json({ organization });
  }),
);

organizationsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(updateOrganizationBodySchema, req.body);
    const organization = await patchOrganizationForUser(req.user.id, params.id, body);
    res.status(200).json({ organization });
  }),
);

const branchBodySchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  postalCode: z.string().max(30).optional(),
  country: z.string().max(100).optional(),
});

organizationsRouter.post(
  "/:id/branches",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(branchBodySchema, req.body);
    const branch = await createOrgBranch(req.user.id, params.id, {
      organizationId: params.id,
      ...body,
    });
    res.status(201).json({ branch });
  }),
);

organizationsRouter.get(
  "/:id/branches",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const branches = await listOrgBranches(req.user.id, params.id);
    res.status(200).json({ branches });
  }),
);

organizationsRouter.patch(
  "/:id/branches/:branchId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(
      organizationIdParamsSchema.extend({ branchId: z.string().uuid() }),
      req.params,
    );
    const body = parseBody(branchBodySchema.partial(), req.body);
    const branch = await patchOrgBranch(req.user.id, params.id, params.branchId, body);
    res.status(200).json({ branch });
  }),
);

organizationsRouter.delete(
  "/:id/branches/:branchId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(
      organizationIdParamsSchema.extend({ branchId: z.string().uuid() }),
      req.params,
    );
    await removeOrgBranch(req.user.id, params.id, params.branchId);
    res.status(200).json({ ok: true });
  }),
);

const departmentBodySchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
  branchId: z.string().uuid().optional(),
});

organizationsRouter.post(
  "/:id/departments",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(departmentBodySchema, req.body);
    const department = await createOrgDepartment(req.user.id, params.id, body);
    res.status(201).json({ department });
  }),
);

organizationsRouter.get(
  "/:id/departments",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const departments = await listOrgDepartments(req.user.id, params.id);
    res.status(200).json({ departments });
  }),
);

organizationsRouter.patch(
  "/:id/departments/:departmentId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(
      organizationIdParamsSchema.extend({ departmentId: z.string().uuid() }),
      req.params,
    );
    const body = parseBody(departmentBodySchema.partial(), req.body);
    const department = await patchOrgDepartment(req.user.id, params.id, params.departmentId, body);
    res.status(200).json({ department });
  }),
);

organizationsRouter.delete(
  "/:id/departments/:departmentId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(
      organizationIdParamsSchema.extend({ departmentId: z.string().uuid() }),
      req.params,
    );
    await removeOrgDepartment(req.user.id, params.id, params.departmentId);
    res.status(200).json({ ok: true });
  }),
);

organizationsRouter.get(
  "/:id/members",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const members = await listOrgMembers(req.user.id, params.id);
    res.status(200).json({ members });
  }),
);

organizationsRouter.patch(
  "/:id/members/:membershipId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(
      organizationIdParamsSchema.extend({ membershipId: z.string().uuid() }),
      req.params,
    );
    const body = parseBody(
      z.object({
        title: z.string().max(200).optional(),
        status: z.enum(["active", "disabled", "suspended"]).optional(),
        branchId: z.string().uuid().nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
      }),
      req.body,
    );
    await patchOrgMember(req.user.id, params.id, params.membershipId, body);
    res.status(200).json({ ok: true });
  }),
);

organizationsRouter.patch(
  "/:id/members/:membershipId/role",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(
      organizationIdParamsSchema.extend({ membershipId: z.string().uuid() }),
      req.params,
    );
    const body = parseBody(
      z.object({
        roleKey: z.enum(["org_admin", "employee", "public_user"]),
      }),
      req.body,
    );
    const result = await updateOrgMemberRole(
      req.user.id,
      params.id,
      params.membershipId,
      body.roleKey,
    );
    res.status(200).json(result);
  }),
);

organizationsRouter.get(
  "/:id/join-requests",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const requests = await listOrgJoinRequests(req.user.id, params.id);
    res.status(200).json({ requests });
  }),
);

organizationsRouter.post(
  "/:id/join-requests/:requestId/approve",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(
      organizationIdParamsSchema.extend({ requestId: z.string().uuid() }),
      req.params,
    );
    const body = parseBody(
      z.object({
        roleKey: z.enum(["org_admin", "employee", "public_user"]).optional(),
        reviewNote: z.string().max(500).optional(),
      }),
      req.body,
    );
    const request = await approveJoinRequest(req.user.id, params.id, params.requestId, body);
    res.status(200).json({ request });
  }),
);

organizationsRouter.post(
  "/:id/join-requests/:requestId/reject",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(
      organizationIdParamsSchema.extend({ requestId: z.string().uuid() }),
      req.params,
    );
    const body = parseBody(
      z.object({
        reviewNote: z.string().max(500).optional(),
      }),
      req.body,
    );
    const request = await rejectJoinRequest(req.user.id, params.id, params.requestId, body);
    res.status(200).json({ request });
  }),
);

organizationsRouter.post(
  "/:id/invitations",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(
      z.object({
        email: z.string().email(),
        roleKey: z.enum(["org_admin", "employee", "public_user"]),
        branchId: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
      }),
      req.body,
    );
    const invitation = await inviteToOrganization(req.user.id, params.id, body);
    res.status(201).json({ invitation });
  }),
);

organizationsRouter.get(
  "/:id/invitations",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const invitations = await listOrgInvitations(req.user.id, params.id);
    res.status(200).json({ invitations });
  }),
);

organizationsRouter.get(
  "/:id/branding",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const branding = await getOrgBranding(req.user.id, params.id);
    res.status(200).json({ branding });
  }),
);

organizationsRouter.put(
  "/:id/branding",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(
      z.object({
        displayName: z.string().max(200).optional(),
        primaryColor: z.string().max(32).optional(),
        secondaryColor: z.string().max(32).optional(),
        logoObjectKey: z.string().max(512).optional(),
      }),
      req.body,
    );
    const branding = await updateOrgBranding(req.user.id, params.id, body);
    res.status(200).json({ branding });
  }),
);

organizationsRouter.post(
  "/:id/branding/logo-upload-url",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(
      z.object({
        contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
      }),
      req.body,
    );
    const upload = await createLogoUploadUrl(req.user.id, params.id, body.contentType);
    res.status(200).json(upload);
  }),
);

organizationsRouter.post(
  "/:id/imports",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(z.object({ csv: z.string().min(1) }), req.body);
    const job = await runBulkImport(req.user.id, params.id, body.csv);
    res.status(201).json({ job });
  }),
);

organizationsRouter.get(
  "/:id/imports/:jobId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(
      organizationIdParamsSchema.extend({ jobId: z.string().uuid() }),
      req.params,
    );
    const job = await getBulkImportJob(req.user.id, params.id, params.jobId);
    res.status(200).json({ job });
  }),
);

organizationsRouter.use("/:id", documentsRouter);
organizationsRouter.use("/:id", organizationBlockchainRouter);
organizationsRouter.use("/:id", organizationVerificationRouter);
organizationsRouter.use("/:id", organizationPublicVerificationRouter);
organizationsRouter.use("/:id", organizationQrRouter);
organizationsRouter.use("/:id", organizationAiRouter);

export const invitationsRouter = Router();

invitationsRouter.post(
  "/accept",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(z.object({ token: z.string().min(1) }), req.body);
    const result = await acceptInvitation(req.user.id, body.token);
    res.status(200).json(result);
  }),
);
