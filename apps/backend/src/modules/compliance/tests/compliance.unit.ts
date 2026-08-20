import assert from "node:assert/strict";
import { ComplianceFrameworks } from "@trustchain/config";
import {
  calculateComplianceScore,
  defaultSignals,
  evaluateRule,
  executeRules,
  listFrameworks,
  mapRuleToFrameworks,
  ComplianceRuleCatalog,
} from "../compliance.engine.js";
import { buildComplianceReport, buildDashboardSummary } from "../compliance.reporting.js";

export function testRuleExecution(): void {
  const failing = defaultSignals();
  const results = executeRules(ComplianceFrameworks.soc2, failing);
  assert.ok(results.length >= 3);
  assert.ok(results.every((r) => r.framework === ComplianceFrameworks.soc2));
  assert.ok(results.some((r) => !r.passed));

  const passing = defaultSignals({
    mfaEnabledRatio: 1,
    auditEventsLast30d: 10,
    incidentResponsePlanPresent: 1,
    accessReviewsLast90d: 1,
  });
  const passed = executeRules(ComplianceFrameworks.soc2, passing);
  assert.ok(passed.every((r) => r.passed));

  const gdpr = evaluateRule(
    ComplianceRuleCatalog.find((r) => r.key === "gdpr.breach_logging")!,
    defaultSignals({ failedAuditRatio: 0.1 }),
  );
  assert.equal(gdpr.passed, true);
  const gdprFail = evaluateRule(
    ComplianceRuleCatalog.find((r) => r.key === "gdpr.breach_logging")!,
    defaultSignals({ failedAuditRatio: 0.5 }),
  );
  assert.equal(gdprFail.passed, false);
}

export function testScoreCalculation(): void {
  const results = executeRules(
    ComplianceFrameworks.iso27001,
    defaultSignals({
      encryptionAtRestEnabled: 1,
      leastPrivilegeEnforced: 1,
      backupVerifiedLast30d: 0,
      vendorRiskAssessed: 0,
    }),
  );
  const score = calculateComplianceScore(results);
  assert.equal(score.totalRules, results.length);
  assert.equal(score.passedRules + score.failedRules, score.totalRules);
  assert.ok(score.score > 0 && score.score < 1);
  assert.ok(["pass", "warn", "fail"].includes(score.grade));

  const empty = calculateComplianceScore([]);
  assert.equal(empty.score, 0);
  assert.equal(empty.totalRules, 0);
}

export function testReporting(): void {
  const results = executeRules(
    ComplianceFrameworks.gdpr,
    defaultSignals({
      dataSubjectRequestProcess: 1,
      documentRetentionPolicyPresent: 0,
      failedAuditRatio: 0.1,
    }),
  );
  const score = calculateComplianceScore(results);
  const report = buildComplianceReport({
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    framework: ComplianceFrameworks.gdpr,
    assessmentId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    score,
    results,
  });
  assert.equal(report.framework, ComplianceFrameworks.gdpr);
  assert.ok(report.summary.includes("GDPR"));
  assert.ok(report.violations.length >= 1);
  assert.equal(report.results.length, results.length);

  const dash = buildDashboardSummary({
    assessments: [
      {
        id: "1",
        framework: "soc2",
        score: 0.9,
        status: "completed",
        finishedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    openViolations: 2,
    openRemediations: 1,
    latestByFramework: { soc2: { score: 0.9, assessmentId: "1" } },
  });
  assert.equal(dash.overallScore, 0.9);
  assert.equal(dash.openViolations, 2);
}

export function testFrameworkMapping(): void {
  const frameworks = listFrameworks();
  assert.equal(frameworks.length, 4);
  assert.ok(frameworks.every((f) => f.ruleCount > 0));
  const ids = frameworks.map((f) => f.id).sort();
  assert.deepEqual(ids, ["gdpr", "hipaa", "iso27001", "soc2"]);

  const mapped = mapRuleToFrameworks("soc2.mfa");
  assert.deepEqual(mapped, [ComplianceFrameworks.soc2]);
  assert.deepEqual(mapRuleToFrameworks("unknown.rule"), []);
}

export function testRemediationTracking(): void {
  const results = executeRules(
    ComplianceFrameworks.hipaa,
    defaultSignals({
      phiAccessLogging: 0,
      mfaEnabledRatio: 0.5,
      incidentResponsePlanPresent: 0,
    }),
  );
  const failures = results.filter((r) => !r.passed);
  assert.ok(failures.length >= 2);

  const remediations = failures.map((f) => ({
    title: `Remediate: ${f.title}`,
    status: "pending" as const,
    hint: f.remediationHint,
    ruleKey: f.ruleKey,
  }));
  assert.ok(remediations.every((r) => r.status === "pending"));
  assert.ok(remediations.every((r) => r.hint.length > 0));

  const completed = remediations.map((r, i) =>
    i === 0 ? { ...r, status: "completed" as const } : r,
  );
  assert.equal(completed.filter((r) => r.status === "completed").length, 1);
  assert.equal(completed.filter((r) => r.status === "pending").length, completed.length - 1);
}
