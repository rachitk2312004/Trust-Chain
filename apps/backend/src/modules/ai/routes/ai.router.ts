import { Router } from "express";
import { asyncHandler } from "../../../lib/asyncHandler.js";
import { requireAuth } from "../../../middleware/requireAuth.js";
import * as controller from "../controllers/ai.controller.js";

/** Authenticated AI gateway — mounted at /api/v1/ai */
export const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.post("/ocr", asyncHandler(controller.postOcr));
aiRouter.post("/classify", asyncHandler(controller.postClassify));
aiRouter.post("/extract", asyncHandler(controller.postExtract));
aiRouter.post("/search", asyncHandler(controller.postSearch));
aiRouter.post("/fraud", asyncHandler(controller.postFraud));
aiRouter.get("/jobs/:jobId", asyncHandler(controller.getJob));

/** Org-scoped companions — mounted under /organizations/:id */
export const organizationAiRouter = Router({ mergeParams: true });
organizationAiRouter.post("/ai/ocr", asyncHandler(controller.postOcr));
organizationAiRouter.post("/ai/classify", asyncHandler(controller.postClassify));
organizationAiRouter.post("/ai/extract", asyncHandler(controller.postExtract));
organizationAiRouter.post("/ai/search", asyncHandler(controller.postSearch));
organizationAiRouter.post("/ai/fraud", asyncHandler(controller.postFraud));
organizationAiRouter.get("/ai/jobs/:jobId", asyncHandler(controller.getOrgJob));
organizationAiRouter.post("/ai/jobs/:jobId/review", asyncHandler(controller.postOrgReview));
organizationAiRouter.get("/ai/analytics", asyncHandler(controller.getAnalytics));
