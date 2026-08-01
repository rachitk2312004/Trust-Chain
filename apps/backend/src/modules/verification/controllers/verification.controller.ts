import type { Request, Response } from "express";
import { AppError } from "../../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../../lib/validate.js";
import * as verification from "../services/verification.service.js";
import {
  historyQuerySchema,
  listVerificationsQuerySchema,
  orgDocumentParamsSchema,
  orgIdParamsSchema,
  orgVerificationParamsSchema,
  verifyBodySchema,
} from "../routes/verification.schemas.js";
import { VerificationModes } from "@trustchain/config";

function requireUser(req: Request): string {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  return req.user.id;
}

export async function postVerify(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
  const body = parseBody(verifyBodySchema, req.body ?? {});
  const idempotencyKey =
    body.idempotencyKey ??
    (typeof req.headers["idempotency-key"] === "string"
      ? req.headers["idempotency-key"]
      : undefined);

  const result = await verification.startDocumentVerification(userId, orgId, documentId, {
    ...body,
    mode: body.mode as "sync" | "async" | undefined,
    idempotencyKey,
  });

  if (result.request.mode === VerificationModes.async && !result.report) {
    res.status(202).json(result);
    return;
  }
  res.status(result.idempotentReplay || result.cached ? 200 : 201).json(result);
}

export async function getVerificationStatus(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
  const status = await verification.getDocumentVerificationStatus(userId, orgId, documentId);
  res.status(200).json(status);
}

export async function getVerificationHistory(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
  const query = parseQuery(historyQuerySchema, req.query);
  const history = await verification.getDocumentVerificationHistory(
    userId,
    orgId,
    documentId,
    query,
  );
  res.status(200).json(history);
}

export async function listVerifications(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
  const query = parseQuery(listVerificationsQuerySchema, req.query);
  const result = await verification.listOrganizationVerifications(userId, orgId, query);
  res.status(200).json(result);
}

export async function getVerification(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, verificationId } = parseParams(orgVerificationParamsSchema, req.params);
  const result = await verification.getVerificationById(userId, orgId, verificationId);
  res.status(200).json(result);
}

export async function processVerifications(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
  const result = await verification.processAsyncVerifications(userId, orgId);
  res.status(200).json(result);
}
