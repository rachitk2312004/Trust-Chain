import { Router } from "express";
import { AuthRateLimit } from "@trustchain/config";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { assertRateLimit } from "../../lib/rateLimit.js";
import { parseBody, parseParams } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { z } from "zod";
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  mfaCodeBodySchema,
  mfaVerifyLoginBodySchema,
  refreshBodySchema,
  registerBodySchema,
  resendVerificationBodySchema,
  resetPasswordBodySchema,
  emailTokenBodySchema,
} from "./auth.schemas.js";
import {
  loginWithPassword,
  registerUser,
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
  verifyEmail,
} from "./auth.service.js";
import { listDevicesForUser, revokeDevice } from "./devices.repository.js";
import { listSessionsForUser } from "./sessions.repository.js";
import { getRequestMeta, logoutSession, refreshSession } from "./session.service.js";
import { revokeAllSessionsForDevice } from "./sessions.repository.js";
import { completeMfaLogin, disableMfa, enableMfa, setupMfa } from "./mfa.service.js";

export const authRouter = Router();

async function authRateLimit(req: { ip?: string }, action: string): Promise<void> {
  const ip = typeof req.ip === "string" && req.ip.length > 0 ? req.ip : "unknown";
  await assertRateLimit({
    key: `auth:${action}:${ip}`,
    maxRequests: AuthRateLimit.maxRequests,
    windowMs: AuthRateLimit.windowMs,
    errorCode: "AUTH_RATE_LIMITED",
    message: "Too many authentication attempts",
  });
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    await authRateLimit(req, "register");
    const body = parseBody(registerBodySchema, req.body);
    const user = await registerUser(body);
    res.status(201).json({ user });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    await authRateLimit(req, "login");
    const body = parseBody(loginBodySchema, req.body);
    const meta = getRequestMeta(req);
    const result = await loginWithPassword({
      ...body,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const body = parseBody(refreshBodySchema, req.body);
    const result = await refreshSession(body.refreshToken);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/mfa/verify",
  asyncHandler(async (req, res) => {
    const body = parseBody(mfaVerifyLoginBodySchema, req.body);
    const meta = getRequestMeta(req);
    const result = await completeMfaLogin({
      challengeToken: body.mfaToken,
      code: body.code,
      deviceName: body.deviceName,
      fingerprint: body.fingerprint,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    res.status(200).json({ mfaRequired: false, ...result });
  }),
);

authRouter.post(
  "/mfa/setup",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }
    const result = await setupMfa(req.user);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/mfa/enable",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }
    const body = parseBody(mfaCodeBodySchema, req.body);
    const result = await enableMfa(req.user, body.code);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/mfa/disable",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }
    const body = parseBody(mfaCodeBodySchema, req.body);
    const result = await disableMfa(req.user, body.code);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user || !req.sessionId) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }
    await logoutSession(req.sessionId, req.user.id);
    res.status(200).json({ ok: true });
  }),
);

authRouter.post(
  "/email/verify",
  asyncHandler(async (req, res) => {
    const body = parseBody(emailTokenBodySchema, req.body);
    const user = await verifyEmail(body.token);
    res.status(200).json({ user });
  }),
);

authRouter.post(
  "/email/resend",
  asyncHandler(async (req, res) => {
    await authRateLimit(req, "email_resend");
    const body = parseBody(resendVerificationBodySchema, req.body);
    await resendEmailVerification(body.email);
    res.status(200).json({ ok: true });
  }),
);

authRouter.post(
  "/password/forgot",
  asyncHandler(async (req, res) => {
    await authRateLimit(req, "password_forgot");
    const body = parseBody(forgotPasswordBodySchema, req.body);
    await requestPasswordReset(body.email);
    res.status(200).json({ ok: true });
  }),
);

authRouter.post(
  "/password/reset",
  asyncHandler(async (req, res) => {
    await authRateLimit(req, "password_reset");
    const body = parseBody(resetPasswordBodySchema, req.body);
    const user = await resetPassword(body);
    res.status(200).json({ user });
  }),
);

authRouter.get(
  "/sessions",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }
    const sessions = await listSessionsForUser(req.user.id);
    res.status(200).json({
      sessions: sessions.map((session) => ({
        id: session.id,
        deviceId: session.device_id,
        ip: session.ip,
        userAgent: session.user_agent,
        expiresAt: session.expires_at,
        createdAt: session.created_at,
        current: session.id === req.sessionId,
      })),
    });
  }),
);

authRouter.delete(
  "/sessions/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }
    const params = parseParams(z.object({ id: z.string().uuid() }), req.params);
    await logoutSession(params.id, req.user.id);
    res.status(200).json({ ok: true });
  }),
);

authRouter.get(
  "/devices",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }
    const devices = await listDevicesForUser(req.user.id);
    res.status(200).json({
      devices: devices.map((device) => ({
        id: device.id,
        name: device.name,
        fingerprint: device.fingerprint,
        userAgent: device.user_agent,
        trusted: device.trusted,
        lastSeenAt: device.last_seen_at,
        createdAt: device.created_at,
      })),
    });
  }),
);

authRouter.delete(
  "/devices/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }
    const params = parseParams(z.object({ id: z.string().uuid() }), req.params);
    const revoked = await revokeDevice(req.user.id, params.id);
    if (!revoked) {
      throw new AppError(404, "DEVICE_NOT_FOUND", "Device not found");
    }
    await revokeAllSessionsForDevice(req.user.id, params.id);
    res.status(200).json({ ok: true });
  }),
);
