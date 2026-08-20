import type { ComplianceFramework } from "@trustchain/config";
import type { AssessmentScore, RuleEvaluationResult } from "./compliance.engine.js";
import { ComplianceFrameworkCatalog } from "./compliance.engine.js";

export type ComplianceReportPayload = {
  generatedAt: string;
  organizationId: string;
  framework: ComplianceFramework;
  frameworkName: string;
  assessmentId: string;
  score: AssessmentScore;
  results: Array<{
    ruleKey: string;
    controlId: string;
    title: string;
    severity: string;
    passed: boolean;
    message: string;
  }>;
  violations: Array<{
    ruleKey: string;
    title: string;
    severity: string;
    remediationHint: string;
  }>;
  summary: string;
};

export function buildComplianceReport(input: {
  organizationId: string;
  framework: ComplianceFramework;
  assessmentId: string;
  score: AssessmentScore;
  results: RuleEvaluationResult[];
}): ComplianceReportPayload {
  const fw = ComplianceFrameworkCatalog.find((f) => f.id === input.framework);
  const violations = input.results
    .filter((r) => !r.passed)
    .map((r) => ({
      ruleKey: r.ruleKey,
      title: r.title,
      severity: r.severity,
      remediationHint: r.remediationHint,
    }));

  const summary = [
    `${fw?.name ?? input.framework} assessment scored ${(input.score.score * 100).toFixed(1)}% (${input.score.grade}).`,
    `${input.score.passedRules}/${input.score.totalRules} controls passed.`,
    violations.length
      ? `${violations.length} violation(s) require remediation.`
      : "No open control failures detected.",
  ].join(" ");

  return {
    generatedAt: new Date().toISOString(),
    organizationId: input.organizationId,
    framework: input.framework,
    frameworkName: fw?.name ?? input.framework,
    assessmentId: input.assessmentId,
    score: input.score,
    results: input.results.map((r) => ({
      ruleKey: r.ruleKey,
      controlId: r.controlId,
      title: r.title,
      severity: r.severity,
      passed: r.passed,
      message: r.message,
    })),
    violations,
    summary,
  };
}

export function buildDashboardSummary(input: {
  assessments: Array<{
    id: string;
    framework: string;
    score: number;
    status: string;
    finishedAt: string | null;
  }>;
  openViolations: number;
  openRemediations: number;
  latestByFramework: Record<string, { score: number; assessmentId: string }>;
}) {
  const scores = Object.values(input.latestByFramework).map((v) => v.score);
  const overall =
    scores.length === 0
      ? 0
      : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000;

  return {
    overallScore: overall,
    frameworksCovered: Object.keys(input.latestByFramework).length,
    openViolations: input.openViolations,
    openRemediations: input.openRemediations,
    recentAssessments: input.assessments.slice(0, 10),
    latestByFramework: input.latestByFramework,
  };
}
