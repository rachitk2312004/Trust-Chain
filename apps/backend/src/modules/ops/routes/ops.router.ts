import { Router } from "express";
import { asyncHandler } from "../../../lib/asyncHandler.js";
import { requireAuth } from "../../../middleware/requireAuth.js";
import * as controller from "../controllers/ops.controller.js";

/** Wave 10 ops gateway — mounted at /api/v1 */
export const opsRouter = Router();
opsRouter.use(requireAuth);

opsRouter.post("/reports", asyncHandler(controller.postReport));
opsRouter.get("/reports/:id", asyncHandler(controller.getReport));

opsRouter.post("/alerts", asyncHandler(controller.postAlert));
opsRouter.get("/alerts", asyncHandler(controller.getAlerts));

opsRouter.post("/investigations", asyncHandler(controller.postInvestigation));
opsRouter.get("/investigations/:id", asyncHandler(controller.getInvestigation));
opsRouter.post("/investigations/:id/evidence", asyncHandler(controller.postEvidence));

opsRouter.post("/billing/subscriptions", asyncHandler(controller.postSubscription));
opsRouter.get("/billing/invoices", asyncHandler(controller.getInvoices));

opsRouter.post("/features", asyncHandler(controller.postFeature));
opsRouter.get("/features", asyncHandler(controller.getFeatures));

opsRouter.post("/compliance", asyncHandler(controller.postCompliance));
opsRouter.get("/compliance", asyncHandler(controller.getCompliance));

opsRouter.post("/ops/governance/policies", asyncHandler(controller.postPolicy));
opsRouter.post("/ops/governance/policies/:id/approve", asyncHandler(controller.postPolicyApprove));
opsRouter.get("/ops/analytics/summary", asyncHandler(controller.getAnalytics));
opsRouter.get("/ops/health", asyncHandler(controller.getHealth));
opsRouter.post("/ops/deployments", asyncHandler(controller.postDeployment));
opsRouter.post("/ops/recovery/backups", asyncHandler(controller.postRecoveryBackup));
opsRouter.post("/ops/capacity", asyncHandler(controller.postCapacity));
