import type { Request, Response } from "express";
import { AppError } from "../../../lib/errors.js";
import { parseBody, parseParams } from "../../../lib/validate.js";
import { clientIp } from "../utils/abuse.js";
import * as svc from "../services/publicVerification.service.js";
import {
  createLinkBodySchema,
  orgDocLinkParamsSchema,
  orgDocParamsSchema,
  publicVerifyBodySchema,
  visibilityBodySchema,
} from "../routes/schemas.js";

function meta(req: Request) {
  return {
    ip: clientIp(req),
    userAgent:
      typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
  };
}

function requireUser(req: Request): string {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  return req.user.id;
}

export async function postPublicVerify(req: Request, res: Response): Promise<void> {
  const body = parseBody(publicVerifyBodySchema, req.body ?? {});
  const report = await svc.publicVerifyBody(body, meta(req));
  res.status(200).json({ report });
}

export async function getByVerifyCode(req: Request, res: Response): Promise<void> {
  const code = String(req.params.verificationId ?? "");
  const report = await svc.publicVerifyByCode(code, meta(req));
  res.status(200).json({ report });
}

export async function getByHash(req: Request, res: Response): Promise<void> {
  const report = await svc.publicVerifyByHash(String(req.params.hash ?? ""), meta(req));
  res.status(200).json({ report });
}

export async function getByTx(req: Request, res: Response): Promise<void> {
  const report = await svc.publicVerifyByTx(String(req.params.transactionHash ?? ""), meta(req));
  res.status(200).json({ report });
}

export async function getByDocument(req: Request, res: Response): Promise<void> {
  // Public path uses PUB-VERIFY code, not UUID
  const report = await svc.publicVerifyByDocumentPublicCode(
    String(req.params.documentId ?? ""),
    meta(req),
  );
  res.status(200).json({ report });
}

export async function getByLink(req: Request, res: Response): Promise<void> {
  const report = await svc.publicVerifyByLinkToken(String(req.params.token ?? ""), meta(req));
  res.status(200).json({ report });
}

export async function patchVisibility(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocParamsSchema, req.params);
  const body = parseBody(visibilityBodySchema, req.body);
  const result = await svc.setDocumentVisibility(userId, orgId, documentId, body.visibility);
  res.status(200).json(result);
}

export async function postLink(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocParamsSchema, req.params);
  const body = parseBody(createLinkBodySchema, req.body ?? {});
  const result = await svc.createPublicLink(userId, orgId, documentId, body);
  res.status(201).json(result);
}

export async function getLinks(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocParamsSchema, req.params);
  const links = await svc.listPublicLinks(userId, orgId, documentId);
  res.status(200).json({ links });
}

export async function revokeLink(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId, publicCode } = parseParams(orgDocLinkParamsSchema, req.params);
  const result = await svc.revokePublicLink(userId, orgId, documentId, publicCode);
  res.status(200).json(result);
}

export async function disableLink(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId, publicCode } = parseParams(orgDocLinkParamsSchema, req.params);
  const result = await svc.disablePublicLink(userId, orgId, documentId, publicCode);
  res.status(200).json(result);
}

export async function getEvents(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocParamsSchema, req.params);
  const events = await svc.listPublicEvents(userId, orgId, documentId);
  res.status(200).json({ events });
}

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocParamsSchema, req.params);
  const analytics = await svc.getPublicAnalytics(userId, orgId, documentId);
  res.status(200).json({ analytics });
}
