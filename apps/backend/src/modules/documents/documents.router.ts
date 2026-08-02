import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import {
  accessPoliciesBodySchema,
  categoryBodySchema,
  confirmVersionBodySchema,
  createDocumentBodySchema,
  createShareBodySchema,
  expirationBodySchema,
  listDocumentsQuerySchema,
  orgCategoryParamsSchema,
  orgDocumentParamsSchema,
  orgDocumentVersionParamsSchema,
  orgIdParamsSchema,
  orgShareParamsSchema,
  orgTagParamsSchema,
  patchDocumentBodySchema,
  tagBodySchema,
  uploadUrlBodySchema,
} from "./documents.schemas.js";
import * as documents from "./documents.service.js";

export const documentsRouter = Router({ mergeParams: true });

function requireUser(req: { user?: { id: string } }): string {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  return req.user.id;
}

// Categories
documentsRouter.post(
  "/document-categories",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
    const body = parseBody(categoryBodySchema, req.body);
    const category = await documents.createCategory(userId, orgId, body);
    res.status(201).json({ category });
  }),
);

documentsRouter.get(
  "/document-categories",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
    const categories = await documents.listCategories(userId, orgId);
    res.status(200).json({ categories });
  }),
);

documentsRouter.patch(
  "/document-categories/:categoryId",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, categoryId } = parseParams(orgCategoryParamsSchema, req.params);
    const body = parseBody(categoryBodySchema.partial(), req.body);
    const category = await documents.patchCategory(userId, orgId, categoryId, body);
    res.status(200).json({ category });
  }),
);

documentsRouter.delete(
  "/document-categories/:categoryId",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, categoryId } = parseParams(orgCategoryParamsSchema, req.params);
    await documents.deleteCategory(userId, orgId, categoryId);
    res.status(204).send();
  }),
);

// Tags
documentsRouter.post(
  "/document-tags",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
    const body = parseBody(tagBodySchema, req.body);
    const tag = await documents.createTag(userId, orgId, body);
    res.status(201).json({ tag });
  }),
);

documentsRouter.get(
  "/document-tags",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
    const tags = await documents.listTags(userId, orgId);
    res.status(200).json({ tags });
  }),
);

documentsRouter.patch(
  "/document-tags/:tagId",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, tagId } = parseParams(orgTagParamsSchema, req.params);
    const body = parseBody(tagBodySchema, req.body);
    const tag = await documents.patchTag(userId, orgId, tagId, body);
    res.status(200).json({ tag });
  }),
);

documentsRouter.delete(
  "/document-tags/:tagId",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, tagId } = parseParams(orgTagParamsSchema, req.params);
    await documents.deleteTag(userId, orgId, tagId);
    res.status(204).send();
  }),
);

// Documents
documentsRouter.post(
  "/documents",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
    const body = parseBody(createDocumentBodySchema, req.body);
    const document = await documents.createDocument(userId, orgId, body);
    res.status(201).json({ document });
  }),
);

documentsRouter.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
    const query = parseQuery(listDocumentsQuerySchema, req.query);
    const result = await documents.listDocuments(userId, orgId, query);
    res.status(200).json(result);
  }),
);

documentsRouter.get(
  "/documents/:documentId",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const document = await documents.getDocument(userId, orgId, documentId);
    res.status(200).json({ document });
  }),
);

documentsRouter.patch(
  "/documents/:documentId",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const body = parseBody(patchDocumentBodySchema, req.body);
    const document = await documents.patchDocument(userId, orgId, documentId, body);
    res.status(200).json({ document });
  }),
);

documentsRouter.delete(
  "/documents/:documentId",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const document = await documents.softDeleteDocument(userId, orgId, documentId);
    res.status(200).json({ document });
  }),
);

documentsRouter.post(
  "/documents/:documentId/upload-url",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const body = parseBody(uploadUrlBodySchema, req.body);
    const result = await documents.createDocumentUploadUrl(userId, orgId, documentId, body);
    res.status(200).json(result);
  }),
);

documentsRouter.post(
  "/documents/:documentId/versions/confirm",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const body = parseBody(confirmVersionBodySchema, req.body);
    const result = await documents.confirmDocumentVersion(userId, orgId, documentId, body);
    res.status(201).json(result);
  }),
);

documentsRouter.get(
  "/documents/:documentId/versions",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const versions = await documents.listDocumentVersions(userId, orgId, documentId);
    res.status(200).json({ versions });
  }),
);

documentsRouter.get(
  "/documents/:documentId/download-url",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const result = await documents.createDocumentDownloadUrl(userId, orgId, documentId);
    res.status(200).json(result);
  }),
);

documentsRouter.get(
  "/documents/:documentId/versions/:versionId/download-url",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const {
      id: orgId,
      documentId,
      versionId,
    } = parseParams(orgDocumentVersionParamsSchema, req.params);
    const result = await documents.createDocumentDownloadUrl(userId, orgId, documentId, versionId);
    res.status(200).json(result);
  }),
);

documentsRouter.get(
  "/documents/:documentId/content",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const versionId =
      typeof req.query.versionId === "string" && req.query.versionId.length > 0
        ? req.query.versionId
        : undefined;

    let headersSent = false;
    await documents.streamDocumentContent(userId, orgId, documentId, versionId, (chunk, meta) => {
      if (!headersSent) {
        res.setHeader("Content-Type", meta.mimeType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${meta.fileName.replace(/"/g, "")}"`,
        );
        res.setHeader("X-TrustChain-Encrypted", meta.encrypted ? "1" : "0");
        res.status(200);
        headersSent = true;
      }
      res.write(chunk);
    });
    res.end();
  }),
);

documentsRouter.post(
  "/documents/:documentId/archive",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const document = await documents.archiveDocument(userId, orgId, documentId);
    res.status(200).json({ document });
  }),
);

documentsRouter.post(
  "/documents/:documentId/restore",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const document = await documents.restoreDocument(userId, orgId, documentId);
    res.status(200).json({ document });
  }),
);

documentsRouter.patch(
  "/documents/:documentId/expiration",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const body = parseBody(expirationBodySchema, req.body);
    const document = await documents.setDocumentExpiration(
      userId,
      orgId,
      documentId,
      body.expiresAt,
    );
    res.status(200).json({ document });
  }),
);

documentsRouter.post(
  "/documents/:documentId/shares",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const body = parseBody(createShareBodySchema, req.body);
    const share = await documents.createDocumentShare(userId, orgId, documentId, body);
    res.status(201).json({ share });
  }),
);

documentsRouter.get(
  "/documents/:documentId/shares",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const shares = await documents.listDocumentShares(userId, orgId, documentId);
    res.status(200).json({ shares });
  }),
);

documentsRouter.delete(
  "/documents/:documentId/shares/:shareId",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId, shareId } = parseParams(orgShareParamsSchema, req.params);
    const share = await documents.revokeDocumentShare(userId, orgId, documentId, shareId);
    res.status(200).json({ share });
  }),
);

documentsRouter.put(
  "/documents/:documentId/access-policies",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const body = parseBody(accessPoliciesBodySchema, req.body);
    const policies = await documents.replaceAccessPolicies(
      userId,
      orgId,
      documentId,
      body.policies,
    );
    res.status(200).json({ policies });
  }),
);

documentsRouter.get(
  "/documents/:documentId/access-policies",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const policies = await documents.listAccessPolicies(userId, orgId, documentId);
    res.status(200).json({ policies });
  }),
);

documentsRouter.get(
  "/documents/:documentId/audit",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const entries = await documents.listDocumentAudit(userId, orgId, documentId);
    res.status(200).json({ entries });
  }),
);
