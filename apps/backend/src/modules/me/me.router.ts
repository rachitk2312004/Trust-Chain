import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { prisma } from "@trustchain/database";
import { listRoleBindingsForUser } from "../auth/rbac.repository.js";
import { toPublicUser } from "../auth/users.repository.js";

export const meRouter = Router();

meRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const roles = await listRoleBindingsForUser(req.user.id);
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id },
      include: {
        organization: {
          select: { name: true, slug: true },
        },
      },
      orderBy: { organization: { name: "asc" } },
    });

    res.status(200).json({
      user: toPublicUser(req.user),
      roles,
      memberships: memberships.map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        organizationName: row.organization.name,
        organizationSlug: row.organization.slug,
        status: row.status,
        title: row.title,
      })),
    });
  }),
);
