import type { Request, Response } from "express";
import { AppError } from "../../../lib/errors.js";
import { parseBody, parseParams } from "../../../lib/validate.js";
import { clientIp } from "../../public-verification/utils/abuse.js";
import * as templateSvc from "../templates/template.service.js";
import * as svc from "../services/qr.service.js";
import {
  batchQrBodySchema,
  batchRotateBodySchema,
  createQrBodySchema,
  createTemplateBodySchema,
  orgDocParamsSchema,
  orgParamsSchema,
  orgQrParamsSchema,
  orgTemplateParamsSchema,
  printExportBodySchema,
  updateTemplateBodySchema,
} from "../validators/schemas.js";

function requireUser(req: Request): string {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  return req.user.id;
}

function meta(req: Request) {
  return {
    ip: clientIp(req),
    userAgent:
      typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
  };
}

export async function getPublicQr(req: Request, res: Response): Promise<void> {
  const result = await svc.publicResolveQr(String(req.params.token ?? ""), meta(req));
  res.status(200).json(result);
}

export async function postTemplate(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId } = parseParams(orgParamsSchema, req.params);
  const body = parseBody(createTemplateBodySchema, req.body);
  const template = await templateSvc.createTemplate(userId, orgId, body);
  res.status(201).json({ template });
}

export async function getTemplates(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId } = parseParams(orgParamsSchema, req.params);
  const templates = await templateSvc.listTemplates(userId, orgId);
  res.status(200).json({ templates });
}

export async function getTemplate(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, templateCode } = parseParams(orgTemplateParamsSchema, req.params);
  const template = await templateSvc.getTemplate(userId, orgId, templateCode);
  res.status(200).json({ template });
}

export async function patchTemplate(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, templateCode } = parseParams(orgTemplateParamsSchema, req.params);
  const body = parseBody(updateTemplateBodySchema, req.body);
  const template = await templateSvc.updateTemplate(userId, orgId, templateCode, body);
  res.status(200).json({ template });
}

export async function postDocumentQr(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocParamsSchema, req.params);
  const body = parseBody(createQrBodySchema, req.body ?? {});
  const result = await svc.createDocumentQr(userId, orgId, documentId, body);
  res.status(201).json(result);
}

export async function getDocumentQrs(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocParamsSchema, req.params);
  const qrs = await svc.listDocumentQrs(userId, orgId, documentId);
  res.status(200).json({ qrs });
}

export async function getOrgQrs(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId } = parseParams(orgParamsSchema, req.params);
  const qrs = await svc.listOrgQrs(userId, orgId);
  res.status(200).json({ qrs });
}

export async function getQr(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, publicCode } = parseParams(orgQrParamsSchema, req.params);
  const qr = await svc.getDocumentQr(userId, orgId, publicCode);
  res.status(200).json({ qr });
}

export async function postRevokeQr(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, publicCode } = parseParams(orgQrParamsSchema, req.params);
  const qr = await svc.revokeQr(userId, orgId, publicCode);
  res.status(200).json({ qr });
}

export async function postDisableQr(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, publicCode } = parseParams(orgQrParamsSchema, req.params);
  const qr = await svc.disableQr(userId, orgId, publicCode);
  res.status(200).json({ qr });
}

export async function postRotateQr(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, publicCode } = parseParams(orgQrParamsSchema, req.params);
  const body = parseBody(createQrBodySchema.partial(), req.body ?? {});
  const result = await svc.rotateQr(userId, orgId, publicCode, body);
  res.status(201).json(result);
}

export async function getQrDownload(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, publicCode } = parseParams(orgQrParamsSchema, req.params);
  const format = String(req.query.format ?? "png");
  if (format !== "png" && format !== "svg" && format !== "base64") {
    throw new AppError(400, "VALIDATION_ERROR", "format must be png, svg, or base64");
  }
  const asset = await svc.downloadQrAsset(userId, orgId, publicCode, format);
  res.setHeader("Content-Type", asset.contentType);
  res.status(200).send(asset.body);
}

export async function postBatchCreate(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId } = parseParams(orgParamsSchema, req.params);
  const body = parseBody(batchQrBodySchema, req.body);
  const result = await svc.batchCreateQrs(userId, orgId, body);
  res.status(201).json(result);
}

export async function postBatchRotate(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId } = parseParams(orgParamsSchema, req.params);
  const body = parseBody(batchRotateBodySchema, req.body);
  const result = await svc.batchRotateQrs(userId, orgId, body);
  res.status(201).json(result);
}

export async function postPrintExport(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId } = parseParams(orgParamsSchema, req.params);
  const body = parseBody(printExportBodySchema, req.body);
  const pdf = await svc.exportPrintPdf(userId, orgId, body);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="trustchain-qr-print.pdf"');
  res.status(200).send(pdf);
}

export async function getDocQrEvents(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocParamsSchema, req.params);
  const events = await svc.listQrEvents(userId, orgId, documentId);
  res.status(200).json({ events });
}

export async function getDocQrAnalytics(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId, documentId } = parseParams(orgDocParamsSchema, req.params);
  const analytics = await svc.getQrAnalytics(userId, orgId, documentId);
  res.status(200).json({ analytics });
}

export async function getOrgQrEvents(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId } = parseParams(orgParamsSchema, req.params);
  const events = await svc.listQrEvents(userId, orgId);
  res.status(200).json({ events });
}

export async function getOrgQrAnalytics(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id: orgId } = parseParams(orgParamsSchema, req.params);
  const analytics = await svc.getQrAnalytics(userId, orgId);
  res.status(200).json({ analytics });
}
