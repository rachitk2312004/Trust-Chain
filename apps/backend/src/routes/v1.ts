import { ApiConstants } from "@trustchain/config";
import { Router } from "express";
import { authRouter } from "../modules/auth/auth.router.js";
import { healthRouter } from "../modules/health/health.router.js";
import { meRouter } from "../modules/me/me.router.js";
import {
  organizationsRouter,
  invitationsRouter,
} from "../modules/organizations/organizations.router.js";
import { blockchainRouter } from "../modules/blockchain/blockchain.router.js";
import { aiRouter } from "../modules/ai/routes/ai.router.js";
import { opsRouter } from "../modules/ops/routes/ops.router.js";
import { notificationsRouter } from "../modules/notifications/notifications.router.js";
import { certificatesRouter } from "../modules/certificates/certificates.router.js";
import { signaturesRouter } from "../modules/signatures/signatures.router.js";
import { adminRouter } from "../modules/admin/admin.router.js";
import { developerRouter } from "../modules/developer/developer.router.js";
import { searchRouter } from "../modules/search/search.router.js";
import { auditRouter } from "../modules/audit/audit.router.js";
import { complianceRouter } from "../modules/compliance/compliance.router.js";
import { evidenceRouter } from "../modules/evidence/evidence.router.js";
import { retentionRouter } from "../modules/retention/retention.router.js";
import { enterpriseRouter } from "../modules/enterprise/enterprise.router.js";
import { organizationPlatformRouter } from "../modules/organization/organization.router.js";
import { regionRouter } from "../modules/region/region.router.js";
import { recoveryRouter } from "../modules/recovery/recovery.router.js";
import { governanceRouter } from "../modules/governance/governance.router.js";
import { walletsRouter } from "../modules/walletsync/walletsync.router.js";
import { integrationRouter } from "../modules/integration/integration.router.js";
import { marketplaceRouter } from "../modules/marketplace/marketplace.router.js";
import { reputationRouter } from "../modules/reputation/reputation.router.js";
import { platformRouter } from "../modules/platform/platform.router.js";

export const v1Router = Router();

v1Router.use(healthRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/me", meRouter);
v1Router.use("/blockchain", blockchainRouter);
v1Router.use("/organizations", organizationsRouter);
v1Router.use("/invitations", invitationsRouter);
v1Router.use("/notifications", notificationsRouter);
v1Router.use("/certificates", certificatesRouter);
v1Router.use("/signatures", signaturesRouter);
v1Router.use("/admin", adminRouter);
v1Router.use("/developer", developerRouter);
v1Router.use("/search", searchRouter);
v1Router.use("/audit", auditRouter);
v1Router.use("/compliance", complianceRouter);
v1Router.use("/evidence", evidenceRouter);
v1Router.use("/retention", retentionRouter);
v1Router.use("/enterprise", enterpriseRouter);
v1Router.use("/organization", organizationPlatformRouter);
v1Router.use("/regions", regionRouter);
v1Router.use("/recovery", recoveryRouter);
v1Router.use("/governance", governanceRouter);
v1Router.use("/wallets", walletsRouter);
v1Router.use("/integrations", integrationRouter);
v1Router.use("/marketplace", marketplaceRouter);
v1Router.use("/reputation", reputationRouter);
v1Router.use("/platform", platformRouter);
v1Router.use("/ai", aiRouter);
v1Router.use(opsRouter);

v1Router.get("/", (_req, res) => {
  res.status(200).json({
    name: "TrustChain API",
    version: "v1",
    prefix: ApiConstants.prefix,
  });
});
