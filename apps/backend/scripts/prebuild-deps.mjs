import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const rootPackagePath = path.join(repoRoot, "package.json");

if (!existsSync(rootPackagePath)) {
  console.error(
    "Could not find the monorepo root. Railway Root Directory must be the TrustChain repository root, not apps/backend.",
  );
  process.exit(1);
}

const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8"));
if (!rootPackage.workspaces) {
  console.error(
    "TrustChain backend must be built from the monorepo root so npm workspaces can resolve @trustchain/config and @trustchain/database.",
  );
  process.exit(1);
}

function run(workspace, script, extraEnv) {
  console.log(`[prebuild] npm run ${script} -w ${workspace}`);
  const result = spawnSync("npm", ["run", script, "-w", workspace], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...(extraEnv ?? {}) },
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("@trustchain/config", "clean");
run("@trustchain/config", "build");
run("@trustchain/database", "db:generate", {
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgresql://build:build@127.0.0.1:5432/build",
});
run("@trustchain/database", "build");
