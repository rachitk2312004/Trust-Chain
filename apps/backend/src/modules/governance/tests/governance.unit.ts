import assert from "node:assert/strict";
import {
  GovernanceControlCatalog,
  buildAssessmentWorkflow,
  buildExecutiveSummary,
  evaluateControl,
  evaluateControlCatalog,
  runAssessmentWorkflow,
} from "../governance.controls.js";
import {
  aggregateRiskPortfolio,
  calculateInherentRiskScore,
  calculateResidualRiskScore,
  riskBand,
  validateOwnership,
} from "../governance.risk.js";
import { AppError } from "../../../lib/errors.js";

export function testRiskScoring(): void {
  assert.equal(calculateInherentRiskScore({ likelihood: 3, impact: 4 }), 12);
  const residual = calculateResidualRiskScore({
    likelihood: 5,
    impact: 5,
    mitigationEffectiveness: 0.6,
  });
  assert.equal(residual.inherentScore, 25);
  assert.ok(residual.residualScore < residual.inherentScore);
  assert.equal(riskBand(4), "low");
  assert.equal(riskBand(9), "medium");
  assert.equal(riskBand(16), "high");
  assert.equal(riskBand(20), "critical");

  assert.throws(
    () => calculateInherentRiskScore({ likelihood: 0, impact: 3 }),
    (err: unknown) => err instanceof AppError,
  );
}

export function testControlEvaluation(): void {
  const control = GovernanceControlCatalog.find((c) => c.key === "soc2.access_control")!;
  const fail = evaluateControl(control, { accessReviewsComplete: 0 });
  assert.equal(fail.passed, false);
  const pass = evaluateControl(control, { accessReviewsComplete: 1 });
  assert.equal(pass.passed, true);

  const catalog = evaluateControlCatalog({
    framework: "pci_dss",
    signals: {
      cardDataEncrypted: 1,
      networkSegmented: 0,
    },
  });
  assert.equal(catalog.evaluations.length, 2);
  assert.equal(catalog.passed, 1);
  assert.equal(catalog.failed, 1);
}

export function testAssessmentWorkflows(): void {
  const steps = buildAssessmentWorkflow();
  assert.equal(steps.length, 5);
  assert.ok(steps.every((s) => s.status === "pending"));

  const control = GovernanceControlCatalog.find((c) => c.key === "nist.identify")!;
  const passed = runAssessmentWorkflow({
    control,
    signals: { nistIdentifyMaturity: 0.8 },
  });
  assert.equal(passed.status, "passed");
  assert.ok(passed.steps.every((s) => s.status === "completed"));

  const waived = runAssessmentWorkflow({
    control,
    signals: {},
    waive: true,
  });
  assert.equal(waived.status, "waived");
  assert.equal(waived.score, 0.5);
}

export function testOwnershipValidation(): void {
  const allowed = new Set(["user-a", "user-b"]);
  assert.equal(
    validateOwnership({ ownerUserId: "user-a", allowedOwnerIds: allowed }).valid,
    true,
  );
  assert.equal(
    validateOwnership({ ownerUserId: "outsider", allowedOwnerIds: allowed }).valid,
    false,
  );
  assert.equal(
    validateOwnership({ ownerUserId: null, allowedOwnerIds: allowed }).valid,
    true,
  );
}

export function testReporting(): void {
  const portfolio = aggregateRiskPortfolio([
    { residualScore: 20, status: "open" },
    { residualScore: 6, status: "mitigating" },
    { residualScore: 25, status: "closed" },
  ]);
  assert.equal(portfolio.openCount, 2);
  assert.equal(portfolio.criticalCount, 1);
  assert.ok(portfolio.portfolioScore > 0 && portfolio.portfolioScore < 1);

  const summary = buildExecutiveSummary({
    frameworksCovered: 4,
    frameworksTotal: 6,
    activePolicies: 3,
    riskPortfolioScore: portfolio.portfolioScore,
    controlCoverageScore: 0.7,
    openCriticalRisks: 1,
    assessmentsPassed: 5,
    assessmentsTotal: 8,
  });
  assert.ok(summary.score >= 0 && summary.score <= 1);
  assert.ok(["strong", "adequate", "weak", "critical"].includes(summary.grade));
  assert.ok(summary.highlights.length >= 1);
}
