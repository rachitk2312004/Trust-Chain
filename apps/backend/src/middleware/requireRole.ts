import type { NextFunction, Request, Response } from "express";
import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../lib/errors.js";
import { userHasRole, userHasRoleFromBindings } from "../modules/auth/rbac.repository.js";

/**
 * Central RBAC middleware — mount after requireAuth.
 * router → auth → rbac → controller → service
 */
export function requireRole(roleKeys: string[], options?: { organizationParam?: string }) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
      }

      const organizationId = options?.organizationParam
        ? (req.params[options.organizationParam] ?? null)
        : null;

      const allowed = await userHasRole(
        req.user.id,
        roleKeys,
        organizationId,
        req.roleBindings,
      );
      if (!allowed) {
        throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Org-scoped membership gate for `/:id` organization routes. */
export const requireOrgMember = requireRole(
  [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee, RoleKeys.publicUser],
  { organizationParam: "id" },
);

/** Ops / admin gate — super_admin, or org_admin for any organization. */
export async function requireOpsAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }
    const isSuper = req.roleBindings
      ? userHasRoleFromBindings(req.roleBindings, [RoleKeys.superAdmin])
      : await userHasRole(req.user.id, [RoleKeys.superAdmin]);
    if (isSuper) {
      next();
      return;
    }
    const binding = await prisma.roleBinding.findFirst({
      where: {
        userId: req.user.id,
        role: { key: RoleKeys.orgAdmin },
      },
    });
    if (!binding) {
      throw new AppError(403, "FORBIDDEN", "Ops admin role required");
    }
    next();
  } catch (error) {
    next(error);
  }
}
