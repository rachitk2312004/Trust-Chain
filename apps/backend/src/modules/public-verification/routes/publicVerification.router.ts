import { Router } from "express";
import { asyncHandler } from "../../../lib/asyncHandler.js";
import * as controller from "../controllers/publicVerification.controller.js";

/** Anonymous public verification API — mounted at /api/public */
export const publicVerificationRouter = Router();

publicVerificationRouter.post("/verify", asyncHandler(controller.postPublicVerify));
publicVerificationRouter.get("/verify/:verificationId", asyncHandler(controller.getByVerifyCode));
publicVerificationRouter.get("/hash/:hash", asyncHandler(controller.getByHash));
publicVerificationRouter.get("/tx/:transactionHash", asyncHandler(controller.getByTx));
publicVerificationRouter.get("/document/:documentId", asyncHandler(controller.getByDocument));
publicVerificationRouter.get("/link/:token", asyncHandler(controller.getByLink));

/** Authenticated org companion routes — mounted under /organizations/:id */
export const organizationPublicVerificationRouter = Router({ mergeParams: true });

organizationPublicVerificationRouter.patch(
  "/documents/:documentId/public-verification",
  asyncHandler(controller.patchVisibility),
);
organizationPublicVerificationRouter.post(
  "/documents/:documentId/public-links",
  asyncHandler(controller.postLink),
);
organizationPublicVerificationRouter.get(
  "/documents/:documentId/public-links",
  asyncHandler(controller.getLinks),
);
organizationPublicVerificationRouter.post(
  "/documents/:documentId/public-links/:publicCode/revoke",
  asyncHandler(controller.revokeLink),
);
organizationPublicVerificationRouter.post(
  "/documents/:documentId/public-links/:publicCode/disable",
  asyncHandler(controller.disableLink),
);
organizationPublicVerificationRouter.get(
  "/documents/:documentId/public-verification/events",
  asyncHandler(controller.getEvents),
);
organizationPublicVerificationRouter.get(
  "/documents/:documentId/public-verification/analytics",
  asyncHandler(controller.getAnalytics),
);
