import type { Severity } from "../../shared/types.js";

export type AlertRule = {
  id: string;
  name: string;
  condition: string;
  severity: Severity;
};

export type AlertDraft = {
  ruleId: string;
  severity: Severity;
  message: string;
  suggestedAction: string;
  autoRemediation: false;
  createdAt: string;
};

export function evaluateRule(
  rule: AlertRule,
  metricValue: number,
  threshold: number,
): AlertDraft | null {
  if (metricValue <= threshold) {
    return null;
  }

  return {
    ruleId: rule.id,
    severity: rule.severity,
    message: `${rule.name}: metric ${metricValue} exceeded threshold ${threshold}`,
    suggestedAction: "Review metrics and acknowledge alert manually",
    autoRemediation: false,
    createdAt: new Date().toISOString(),
  };
}
