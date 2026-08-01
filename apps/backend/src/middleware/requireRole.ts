import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { userHasRole } from "../modules/auth/rbac.repository.js";

export function requireRole(roleKeys: string[], options?: { organizationParam?: string }) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
      }

      const organizationId = options?.organizationParam
        ? (req.params[options.organizationParam] ?? null)
        : null;

      const allowed = await userHasRole(req.user.id, roleKeys, organizationId);
      if (!allowed) {
        throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
