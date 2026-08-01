import { Router } from "express";
import { asyncHandler } from "../../../lib/asyncHandler.js";
import * as controller from "../controllers/verification.controller.js";

export const organizationVerificationRouter = Router({ mergeParams: true });

organizationVerificationRouter.post(
  "/documents/:documentId/verify",
  asyncHandler(controller.postVerify),
);

organizationVerificationRouter.get(
  "/documents/:documentId/verification-status",
  asyncHandler(controller.getVerificationStatus),
);

organizationVerificationRouter.get(
  "/documents/:documentId/verification-history",
  asyncHandler(controller.getVerificationHistory),
);

organizationVerificationRouter.get("/verifications", asyncHandler(controller.listVerifications));

organizationVerificationRouter.get(
  "/verifications/:verificationId",
  asyncHandler(controller.getVerification),
);

organizationVerificationRouter.post(
  "/verifications/process",
  asyncHandler(controller.processVerifications),
);
