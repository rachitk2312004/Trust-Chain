import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { findUserById, type UserRow } from "../modules/auth/users.repository.js";
import { findValidSessionById } from "../modules/auth/sessions.repository.js";

export type AuthenticatedRequest = Request & {
  user: UserRow;
  sessionId: string;
};

declare module "express-serve-static-core" {
  interface Request {
    user?: UserRow;
    sessionId?: string;
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
    }

    const token = header.slice("Bearer ".length).trim();
    const payload = verifyAccessToken(token);
    const session = await findValidSessionById(payload.sid);
    if (!session || session.user_id !== payload.sub) {
      throw new AppError(401, "UNAUTHORIZED", "Session is invalid or revoked");
    }

    const user = await findUserById(payload.sub);
    if (!user || user.status === "disabled") {
      throw new AppError(401, "UNAUTHORIZED", "User is not authorized");
    }

    req.user = user;
    req.sessionId = session.id;
    next();
  } catch (error) {
    next(error);
  }
}
