import {
  ComplianceDefaults,
  ComplianceFrameworks,
  type ComplianceFramework,
} from "@trustchain/config";

export type ComplianceSeverity = "low" | "medium" | "high" | "critical";

export type ComplianceRuleDefinition = {
  key: string;
  framework: ComplianceFramework;
  title: string;
  description: string;
  controlId: string;
  severity: ComplianceSeverity;
  weight: number;
  /** Signal key evaluated against ComplianceSignals. */
  signal: keyof ComplianceSignals;
  /** Minimum numeric signal value required to pass (inclusive). */
  minValue: number;
  remediationHint: string;
};

export type ComplianceSignals = {
  mfaEnabledRatio: number;
  auditEventsLast30d: number;
  failedAuditRatio: number;
  documentRetentionPolicyPresent: number;
  encryptionAtRestEnabled: number;
  accessReviewsLast90d: number;
  dataSubjectRequestProcess: number;
  phiAccessLogging: number;
  backupVerifiedLast30d: number;
  incidentResponsePlanPresent: number;
  vendorRiskAssessed: number;
  leastPrivilegeEnforced: number;
};

export type RuleEvaluationResult = {
  ruleKey: string;
  framework: ComplianceFramework;
  title: string;
  severity: ComplianceSeverity;
  controlId: string;
  passed: boolean;
  score: number;
  weight: number;
  message: string;
  evidence: Record<string, unknown>;
  remediationHint: string;
};

export type AssessmentScore = {
  score: number;
  passedRules: number;
  failedRules: number;
  totalRules: number;
  grade: "pass" | "warn" | "fail";
};

export const ComplianceFrameworkCatalog: Array<{
  id: ComplianceFramework;
  name: string;
  description: string;
  version: string;
}> = [
  {
    id: ComplianceFrameworks.soc2,
    name: "SOC 2",
    description: "Trust Services Criteria for security, availability, and confidentiality.",
    version: "2017",
  },
  {
    id: ComplianceFrameworks.iso27001,
    name: "ISO 27001",
    description: "Information security management system controls.",
    version: "2022",
  },
  {
    id: ComplianceFrameworks.gdpr,
    name: "GDPR",
    description: "EU general data protection regulation obligations.",
    version: "2016/679",
  },
  {
    id: ComplianceFrameworks.hipaa,
    name: "HIPAA",
    description: "US health information privacy and security safeguards.",
    version: "Security Rule",
  },
];

/** Built-in regulatory rules mapped to frameworks. */
export const ComplianceRuleCatalog: ComplianceRuleDefinition[] = [
  // SOC 2
  {
    key: "soc2.mfa",
    framework: ComplianceFrameworks.soc2,
    title: "Multi-factor authentication",
    description: "Privileged and user access requires MFA.",
    controlId: "CC6.1",
    severity: "high",
    weight: 1.2,
    signal: "mfaEnabledRatio",
    minValue: 0.8,
    remediationHint: "Enforce MFA for all organization members.",
  },
  {
    key: "soc2.audit_logging",
    framework: ComplianceFrameworks.soc2,
    title: "Security audit logging",
    description: "Security-relevant events are recorded continuously.",
    controlId: "CC7.2",
    severity: "high",
    weight: 1.1,
    signal: "auditEventsLast30d",
    minValue: 1,
    remediationHint: "Enable platform audit logging and verify recent events exist.",
  },
  {
    key: "soc2.incident_response",
    framework: ComplianceFrameworks.soc2,
    title: "Incident response plan",
    description: "Documented incident response procedures exist.",
    controlId: "CC7.4",
    severity: "medium",
    weight: 1,
    signal: "incidentResponsePlanPresent",
    minValue: 1,
    remediationHint: "Publish and acknowledge an incident response plan.",
  },
  {
    key: "soc2.access_reviews",
    framework: ComplianceFrameworks.soc2,
    title: "Periodic access reviews",
    description: "Access rights are reviewed at least quarterly.",
    controlId: "CC6.2",
    severity: "medium",
    weight: 1,
    signal: "accessReviewsLast90d",
    minValue: 1,
    remediationHint: "Complete an access review within the last 90 days.",
  },
  // ISO 27001
  {
    key: "iso27001.encryption",
    framework: ComplianceFrameworks.iso27001,
    title: "Encryption at rest",
    description: "Sensitive information is encrypted at rest.",
    controlId: "A.8.24",
    severity: "high",
    weight: 1.2,
    signal: "encryptionAtRestEnabled",
    minValue: 1,
    remediationHint: "Enable document encryption at rest for the organization.",
  },
  {
    key: "iso27001.least_privilege",
    framework: ComplianceFrameworks.iso27001,
    title: "Least privilege access",
    description: "Access is limited to authorized roles.",
    controlId: "A.5.15",
    severity: "high",
    weight: 1.1,
    signal: "leastPrivilegeEnforced",
    minValue: 1,
    remediationHint: "Review role bindings and remove excessive privileges.",
  },
  {
    key: "iso27001.backups",
    framework: ComplianceFrameworks.iso27001,
    title: "Backup verification",
    description: "Backups are verified periodically.",
    controlId: "A.8.13",
    severity: "medium",
    weight: 1,
    signal: "backupVerifiedLast30d",
    minValue: 1,
    remediationHint: "Run and record a backup verification in the last 30 days.",
  },
  {
    key: "iso27001.vendor_risk",
    framework: ComplianceFrameworks.iso27001,
    title: "Supplier risk assessment",
    description: "Critical vendors are risk-assessed.",
    controlId: "A.5.19",
    severity: "medium",
    weight: 0.9,
    signal: "vendorRiskAssessed",
    minValue: 1,
    remediationHint: "Complete vendor risk assessments for critical suppliers.",
  },
  // GDPR
  {
    key: "gdpr.dsar_process",
    framework: ComplianceFrameworks.gdpr,
    title: "Data subject request process",
    description: "Process exists for access/erasure requests.",
    controlId: "Art.15-17",
    severity: "high",
    weight: 1.2,
    signal: "dataSubjectRequestProcess",
    minValue: 1,
    remediationHint: "Document and enable a data subject request workflow.",
  },
  {
    key: "gdpr.retention",
    framework: ComplianceFrameworks.gdpr,
    title: "Data retention policy",
    description: "Retention and deletion policy is defined.",
    controlId: "Art.5(1)(e)",
    severity: "high",
    weight: 1.1,
    signal: "documentRetentionPolicyPresent",
    minValue: 1,
    remediationHint: "Configure document retention / archival policies.",
  },
  {
    key: "gdpr.breach_logging",
    framework: ComplianceFrameworks.gdpr,
    title: "Security event monitoring",
    description: "Security failures are monitored with low failure ratio.",
    controlId: "Art.32",
    severity: "medium",
    weight: 1,
    signal: "failedAuditRatio",
    minValue: 0, // special: pass when value <= 0.25 — handled in evaluateRule
    remediationHint: "Investigate elevated audit failure rates.",
  },
  // HIPAA
  {
    key: "hipaa.phi_access_logging",
    framework: ComplianceFrameworks.hipaa,
    title: "PHI access logging",
    description: "Access to protected health information is logged.",
    controlId: "§164.312(b)",
    severity: "critical",
    weight: 1.3,
    signal: "phiAccessLogging",
    minValue: 1,
    remediationHint: "Enable PHI access logging for healthcare workloads.",
  },
  {
    key: "hipaa.mfa",
    framework: ComplianceFrameworks.hipaa,
    title: "Workforce MFA",
    description: "Workforce members authenticate with MFA.",
    controlId: "§164.312(d)",
    severity: "high",
    weight: 1.2,
    signal: "mfaEnabledRatio",
    minValue: 0.9,
    remediationHint: "Raise MFA coverage above 90% for HIPAA scope.",
  },
  {
    key: "hipaa.incident_response",
    framework: ComplianceFrameworks.hipaa,
    title: "Security incident procedures",
    description: "Incident response procedures are documented.",
    controlId: "§164.308(a)(6)",
    severity: "high",
    weight: 1.1,
    signal: "incidentResponsePlanPresent",
    minValue: 1,
    remediationHint: "Adopt HIPAA-aligned incident response procedures.",
  },
];

export function listFrameworks() {
  return ComplianceFrameworkCatalog.map((fw) => ({
    ...fw,
    ruleCount: ComplianceRuleCatalog.filter((r) => r.framework === fw.id).length,
    controls: ComplianceRuleCatalog.filter((r) => r.framework === fw.id).map((r) => ({
      key: r.key,
      controlId: r.controlId,
      title: r.title,
      severity: r.severity,
    })),
  }));
}

export function rulesForFramework(framework: ComplianceFramework): ComplianceRuleDefinition[] {
  return ComplianceRuleCatalog.filter((r) => r.framework === framework);
}

export function mapRuleToFrameworks(ruleKey: string): ComplianceFramework[] {
  return ComplianceRuleCatalog.filter((r) => r.key === ruleKey).map((r) => r.framework);
}

export function evaluateRule(
  rule: ComplianceRuleDefinition,
  signals: ComplianceSignals,
): RuleEvaluationResult {
  const value = signals[rule.signal];
  let passed: boolean;
  if (rule.key === "gdpr.breach_logging") {
    passed = value <= 0.25;
  } else {
    passed = value >= rule.minValue;
  }

  return {
    ruleKey: rule.key,
    framework: rule.framework,
    title: rule.title,
    severity: rule.severity,
    controlId: rule.controlId,
    passed,
    score: passed ? 1 : 0,
    weight: rule.weight,
    message: passed
      ? `${rule.title} passed (${rule.signal}=${value})`
      : `${rule.title} failed (${rule.signal}=${value}, required ${
          rule.key === "gdpr.breach_logging" ? "<=0.25" : `>=${rule.minValue}`
        })`,
    evidence: { signal: rule.signal, value, minValue: rule.minValue },
    remediationHint: rule.remediationHint,
  };
}

export function executeRules(
  framework: ComplianceFramework,
  signals: ComplianceSignals,
): RuleEvaluationResult[] {
  return rulesForFramework(framework).map((rule) => evaluateRule(rule, signals));
}

export function calculateComplianceScore(results: RuleEvaluationResult[]): AssessmentScore {
  const totalRules = results.length;
  const passedRules = results.filter((r) => r.passed).length;
  const failedRules = totalRules - passedRules;
  const weightSum = results.reduce((sum, r) => sum + r.weight, 0) || 1;
  const weighted = results.reduce((sum, r) => sum + r.score * r.weight, 0);
  const score = Math.round((weighted / weightSum) * 1000) / 1000;
  const grade =
    score >= ComplianceDefaults.passThreshold
      ? "pass"
      : score >= ComplianceDefaults.warnThreshold
        ? "warn"
        : "fail";
  return { score, passedRules, failedRules, totalRules, grade };
}

export function defaultSignals(overrides?: Partial<ComplianceSignals>): ComplianceSignals {
  return {
    mfaEnabledRatio: 0,
    auditEventsLast30d: 0,
    failedAuditRatio: 0,
    documentRetentionPolicyPresent: 0,
    encryptionAtRestEnabled: 0,
    accessReviewsLast90d: 0,
    dataSubjectRequestProcess: 0,
    phiAccessLogging: 0,
    backupVerifiedLast30d: 0,
    incidentResponsePlanPresent: 0,
    vendorRiskAssessed: 0,
    leastPrivilegeEnforced: 0,
    ...overrides,
  };
}

export function suggestedRemediationTitle(result: RuleEvaluationResult): string {
  return `Remediate: ${result.title}`;
}
