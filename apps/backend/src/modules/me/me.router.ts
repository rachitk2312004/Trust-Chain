import { RoleKeys } from "@trustchain/config";
import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { rolesForDisplay } from "../../lib/roleDisplay.js";
import { parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { prisma } from "@trustchain/database";
import { listRoleBindingsForUser } from "../auth/rbac.repository.js";
import { toPublicUser } from "../auth/users.repository.js";
import {
  downloadMyCertificateExport,
  getMyCertificate,
  listMyCertificates,
} from "../certificates/certificates.service.js";
import {
  myCertificateExportParamsSchema,
  myCertificateIdParamsSchema,
  myCertificatesQuerySchema,
} from "../wallet/wallet.schemas.js";

export const meRouter = Router();

meRouter.get(
  "/certificates",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(myCertificatesQuerySchema, req.query);
    const data = await listMyCertificates(req.user.id, query);
    res.status(200).json(data);
  }),
);

meRouter.get(
  "/certificates/:certificateId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(myCertificateIdParamsSchema, req.params);
    const data = await getMyCertificate(req.user.id, params.certificateId);
    res.status(200).json(data);
  }),
);

meRouter.get(
  "/certificates/:certificateId/:format",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(myCertificateExportParamsSchema, req.params);
    const file = await downloadMyCertificateExport(
      req.user.id,
      params.certificateId,
      params.format,
    );
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    if (file.warnings.length) res.setHeader("X-Certificate-Warnings", file.warnings.join("; "));
    res.status(200).send(file.body);
  }),
);

meRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }

    let roles = rolesForDisplay(req.roleBindings ?? (await listRoleBindingsForUser(req.user.id)));
    const isSuperAdmin = roles.some((r) => r.roleKey === RoleKeys.superAdmin);
    if (isSuperAdmin) {
      roles = roles.filter(
        (r) => !(r.roleKey === RoleKeys.orgAdmin && r.organizationId != null),
      );
    }

    const memberships = isSuperAdmin
      ? []
      : await prisma.$queryRaw<
      Array<{
        id: string;
        organizationId: string;
        organizationName: string;
        organizationSlug: string;
        status: string;
        title: string | null;
      }>
    >`
      SELECT
        m.id,
        m.organization_id AS "organizationId",
        o.name AS "organizationName",
        o.slug AS "organizationSlug",
        m.status,
        m.title
      FROM memberships m
      INNER JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = ${req.user.id}::uuid
      ORDER BY o.name ASC
    `;

    res.status(200).json({
      user: toPublicUser(req.user),
      roles,
      memberships: memberships.map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        organizationSlug: row.organizationSlug,
        status: row.status,
        title: row.title,
      })),
    });
  }),
);
