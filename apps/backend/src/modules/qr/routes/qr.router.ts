import { Router } from "express";
import { asyncHandler } from "../../../lib/asyncHandler.js";
import * as controller from "../controllers/qr.controller.js";

/** Public QR scan — mounted under /api/public */
export const publicQrRouter = Router();
publicQrRouter.get("/qr/:token", asyncHandler(controller.getPublicQr));

/** Authenticated org QR routes — mounted under /organizations/:id */
export const organizationQrRouter = Router({ mergeParams: true });

organizationQrRouter.post("/qr/templates", asyncHandler(controller.postTemplate));
organizationQrRouter.get("/qr/templates", asyncHandler(controller.getTemplates));
organizationQrRouter.get("/qr/templates/:templateCode", asyncHandler(controller.getTemplate));
organizationQrRouter.patch("/qr/templates/:templateCode", asyncHandler(controller.patchTemplate));

organizationQrRouter.post("/qr/batch", asyncHandler(controller.postBatchCreate));
organizationQrRouter.post("/qr/batch/rotate", asyncHandler(controller.postBatchRotate));
organizationQrRouter.post("/qr/print", asyncHandler(controller.postPrintExport));

organizationQrRouter.get("/qr", asyncHandler(controller.getOrgQrs));
organizationQrRouter.get("/qr/events", asyncHandler(controller.getOrgQrEvents));
organizationQrRouter.get("/qr/analytics", asyncHandler(controller.getOrgQrAnalytics));
organizationQrRouter.get("/qr/:publicCode", asyncHandler(controller.getQr));
organizationQrRouter.get("/qr/:publicCode/download", asyncHandler(controller.getQrDownload));
organizationQrRouter.post("/qr/:publicCode/revoke", asyncHandler(controller.postRevokeQr));
organizationQrRouter.post("/qr/:publicCode/disable", asyncHandler(controller.postDisableQr));
organizationQrRouter.post("/qr/:publicCode/rotate", asyncHandler(controller.postRotateQr));

organizationQrRouter.post("/documents/:documentId/qr", asyncHandler(controller.postDocumentQr));
organizationQrRouter.get("/documents/:documentId/qr", asyncHandler(controller.getDocumentQrs));
organizationQrRouter.get(
  "/documents/:documentId/qr/events",
  asyncHandler(controller.getDocQrEvents),
);
organizationQrRouter.get(
  "/documents/:documentId/qr/analytics",
  asyncHandler(controller.getDocQrAnalytics),
);
