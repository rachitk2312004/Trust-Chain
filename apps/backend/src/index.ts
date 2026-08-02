import "./loadEnv.js";
import { createApp, getPort } from "./app.js";
import { bootstrapSuperAdmin } from "./bootstrap/superAdmin.js";
import { assertRequiredRuntimeSecrets } from "./lib/runtimeSecrets.js";

assertRequiredRuntimeSecrets();

const app = createApp();
const port = getPort();

app.listen(port, () => {
  console.log(`TrustChain API listening on http://localhost:${port}`);
  void bootstrapSuperAdmin().catch((error: unknown) => {
    console.error("Super admin bootstrap failed", error);
  });
});
