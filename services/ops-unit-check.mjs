/**
 * Wave 10 operational intelligence unit checks (tsx / TypeScript imports).
 *
 * Run:
 *   node --import tsx/esm services/ops-unit-check.mjs
 *
 * CI fallback (no tsx):
 *   npx tsc -p services/tsconfig.json && node services/ops-unit-check-dist.mjs
 */
import assert from "node:assert/strict";

import { summarizeMetrics, detectAnomaly, computePlatformScores } from "./analytics/src/index.ts";
import { buildHealthSnapshot, log, startSpan, endSpan } from "./monitoring/src/index.ts";
import {
  createPolicyDraft,
  canActivatePolicy,
  resolveApproval,
  requestApproval,
} from "./governance/src/index.ts";
import { buildReportSummary } from "./reporting/src/index.ts";
import {
  gdprChecklist,
  soc2Checklist,
  iso27001Checklist,
  markItemComplete,
} from "./compliance/src/index.ts";
import { evaluateRule, maxSeverity } from "./alerting/src/index.ts";
import {
  createRelease,
  listEnvironments,
  createRollbackPlan,
  createMigrationChecklist,
  requestDeploymentApproval,
  isDeploymentApproved,
} from "./deployment/src/index.ts";
import {
  recordBackup,
  createSnapshot,
  buildRestorationPlan,
  validateRecovery,
} from "./recovery/src/index.ts";
import {
  computeStorageUsage,
  computeUsage,
  networkUsage,
  forecastLinear,
} from "./capacity/src/index.ts";
import {
  classifyResource,
  appendLineageStep,
  defineDataRetention,
  registerCatalogEntry,
  clearCatalog,
} from "./data/src/index.ts";
import {
  registerService,
  defaultTopology,
  mapDependencies,
  checkServiceHealth,
  clearRegistry,
} from "./discovery/src/index.ts";
import {
  scheduleRotation,
  validateSecretRef,
  describeSecretRef,
  checkSecretAccess,
  clearSecretAudit,
} from "./secrets/src/index.ts";
import { publishEvent, consumeEvents, replayEvents, clearEventBus } from "./events/src/index.ts";

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

console.log("Wave 10 ops unit checks\n");

test("analytics: summarizeMetrics", () => {
  const summaries = summarizeMetrics([{ name: "latency", values: [10, 20, 30] }]);
  assert.equal(summaries[0]?.avg, 20);
  assert.equal(summaries[0]?.count, 3);
});

test("analytics: detectAnomaly suggests alert only", () => {
  const result = detectAnomaly([1, 1, 1, 100], 5);
  assert.equal(result.isAnomaly, true);
  assert.match(result.suggestion ?? "", /Alert suggestion/);
});

test("analytics: computePlatformScores returns 0..1", () => {
  const scores = computePlatformScores({
    trustSignals: 0.8,
    healthSignals: 1.2,
    riskSignals: -0.1,
    complianceSignals: 0.5,
  });
  assert.equal(scores.trustScore, 0.8);
  assert.equal(scores.healthScore, 1);
  assert.equal(scores.riskScore, 0);
  assert.equal(scores.complianceScore, 0.5);
});

test("monitoring: buildHealthSnapshot", () => {
  const snapshot = buildHealthSnapshot();
  assert.ok(["healthy", "degraded", "unhealthy"].includes(snapshot.overall));
  assert.ok(snapshot.components.length > 0);
});

test("monitoring: logging and tracing stubs", () => {
  const entry = log("info", "test");
  assert.equal(entry.level, "info");
  const span = endSpan(startSpan("request"), 12);
  assert.equal(span.durationMs, 12);
});

test("governance: policy requires approval", () => {
  const draft = createPolicyDraft({
    name: "retention",
    description: "stub",
    rules: ["no-auto-enforce"],
  });
  assert.equal(canActivatePolicy(draft), false);
  const approved = { ...draft, approvalStatus: "approved" };
  assert.equal(canActivatePolicy(approved), true);
});

test("governance: approval flow", () => {
  const req = requestApproval("deploy", "ops");
  const resolved = resolveApproval(req, "approved");
  assert.equal(resolved.status, "approved");
});

test("reporting: buildReportSummary", () => {
  const report = buildReportSummary({
    title: "Weekly",
    sections: [{ title: "Alerts", items: ["a", "b"] }],
  });
  assert.equal(report.recordCount, 2);
});

test("compliance: framework checklists", () => {
  assert.equal(gdprChecklist().framework, "gdpr");
  assert.equal(soc2Checklist().framework, "soc2");
  assert.equal(iso27001Checklist().framework, "iso27001");
  const updated = markItemComplete(gdprChecklist(), "gdpr-1");
  assert.ok(updated.completionRate > 0);
});

test("alerting: evaluateRule never remediates", () => {
  const draft = evaluateRule({ id: "r1", name: "cpu", condition: ">", severity: "high" }, 95, 80);
  assert.ok(draft);
  assert.equal(draft?.autoRemediation, false);
  assert.equal(
    evaluateRule({ id: "r2", name: "cpu", condition: ">", severity: "low" }, 10, 80),
    null,
  );
});

test("alerting: severity ranking", () => {
  assert.equal(maxSeverity(["low", "critical", "medium"]), "critical");
});

test("deployment: release and deployment codes", () => {
  const release = createRelease("1.0.0");
  assert.match(release.code, /^RELEASE-[0-9a-f]{8}$/);
  const approval = requestDeploymentApproval();
  assert.match(approval.deploymentCode, /^DEPLOYMENT-[0-9a-f]{8}$/);
  assert.equal(isDeploymentApproved(approval), false);
});

test("deployment: environments and rollback", () => {
  assert.equal(listEnvironments().length, 3);
  const plan = createRollbackPlan("RELEASE-deadbeef");
  assert.equal(plan.approvalRequired, true);
  assert.ok(createMigrationChecklist().steps.length > 0);
});

test("recovery: metadata only, no auto restore", () => {
  const backup = recordBackup("db", 1024);
  assert.ok(backup.encrypted);
  const plan = buildRestorationPlan(backup.id);
  assert.equal(plan.destructive, false);
  assert.equal(plan.approvalRequired, true);
  assert.equal(validateRecovery([{ name: "checksum", ok: true }]).passed, true);
  assert.ok(createSnapshot("vol-1").id.startsWith("SNAPSHOT-"));
});

test("capacity: usage and forecast", () => {
  assert.equal(computeStorageUsage(50, 100).utilization, 0.5);
  assert.equal(computeUsage(40, 512, 2).instances, 2);
  assert.equal(networkUsage(10, 20, 5).connections, 5);
  assert.equal(forecastLinear([10, 20, 30]).length, 3);
});

test("data: classification, lineage, catalog", () => {
  clearCatalog();
  const resource = classifyResource("doc-1", "confidential", "PII");
  assert.equal(resource.label, "confidential");
  const lineage = appendLineageStep([], "ingest", "scan");
  assert.equal(lineage.length, 1);
  assert.equal(defineDataRetention("logs", 90).retentionDays, 90);
  const entry = registerCatalogEntry("users", "data-team");
  assert.equal(entry.name, "users");
});

test("discovery: registry, topology, dependencies", () => {
  clearRegistry();
  const svc = registerService("api", "1.0", "http://localhost:3000");
  assert.ok(svc.id.startsWith("SVC-"));
  assert.equal(defaultTopology().length, 3);
  assert.equal(mapDependencies([["api", "db", "sync"]]).length, 1);
  assert.equal(checkServiceHealth("api", "up").status, "up");
});

test("secrets: refs only, never raw values", () => {
  clearSecretAudit();
  const ref = describeSecretRef({ id: "db", provider: "vault", path: "prod/db/url" });
  assert.deepEqual(ref, { id: "db", provider: "vault", path: "prod/db/url" });
  assert.equal(validateSecretRef(ref).valid, true);
  assert.equal(checkSecretAccess("db", "ops", ["ops"]).allowed, true);
  assert.ok(scheduleRotation("db", 30).nextRotationAt);
});

test("events: publish, consume, replay", () => {
  clearEventBus();
  publishEvent("user.created", { id: "u1" });
  let consumed = 0;
  consumeEvents("user.created", () => {
    consumed += 1;
  });
  assert.equal(consumed, 1);
  assert.equal(replayEvents(0).length, 1);
});

console.log(`\n${passed} checks passed`);
