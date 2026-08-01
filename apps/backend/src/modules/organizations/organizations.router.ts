import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createOrganizationBodySchema,
  organizationIdParamsSchema,
  updateOrganizationBodySchema,
} from "./organizations.schemas.js";
import {
  createOrganizationForUser,
  getOrganizationForUser,
  listUserOrganizations,
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
import { documentsRouter } from "../documents/documents.router.js";
import { organizationBlockchainRouter } from "../blockchain/blockchain.router.js";
import { organizationVerificationRouter } from "../verification/routes/verification.router.js";

export const organizationsRouter = Router();

organizationsRouter.use(requireAuth);
organizationsRouter.use("/:id", documentsRouter);
organizationsRouter.use("/:id", organizationBlockchainRouter);
organizationsRouter.use("/:id", organizationVerificationRouter);

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
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const organizations = await listUserOrganizations(req.user.id);
    res.status(200).json({ organizations });
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
        status: z.enum(["active", "disabled"]).optional(),
        branchId: z.string().uuid().nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
      }),
      req.body,
    );
    await patchOrgMember(req.user.id, params.id, params.membershipId, body);
    res.status(200).json({ ok: true });
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
