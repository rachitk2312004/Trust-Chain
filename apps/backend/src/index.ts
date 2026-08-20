import "./loadEnv.js";
import { prisma } from "@trustchain/database";
import { createApp, getPort } from "./app.js";
import { bootstrapSuperAdmin } from "./bootstrap/superAdmin.js";
import { cleanupRedundantPublicUserRoles, cleanupSuperAdminOrgBindings } from "./bootstrap/roleCleanup.js";
import { assertRequiredRuntimeSecrets } from "./lib/runtimeSecrets.js";
import { startNotificationScheduler } from "./modules/notifications/notification.scheduler.js";

assertRequiredRuntimeSecrets();

void prisma.$connect().catch((error: unknown) => {
  console.error("Database connection failed — is Postgres running?", error);
});

const app = createApp();
const port = getPort();

app.listen(port, () => {
  console.log(`TrustChain API listening on http://localhost:${port}`);
  void bootstrapSuperAdmin().catch((error: unknown) => {
    console.error("Super admin bootstrap failed", error);
  });
  void cleanupRedundantPublicUserRoles().catch((error: unknown) => {
    console.error("Role cleanup failed", error);
  });
  void cleanupSuperAdminOrgBindings().catch((error: unknown) => {
    console.error("Super admin org binding cleanup failed", error);
  });
  startNotificationScheduler();
});
