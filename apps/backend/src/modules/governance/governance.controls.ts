import {
  GovernanceAssessmentStatuses,
  GovernanceFrameworks,
  type GovernanceFramework,
} from "@trustchain/config";

export type ControlDefinition = {
  key: string;
  framework: GovernanceFramework;
  title: string;
  description: string;
  category: string;
  weight: number;
};

export type ControlSignalMap = Record<string, number>;

export type ControlEvaluation = {
  controlKey: string;
  framework: GovernanceFramework;
  title: string;
  passed: boolean;
  score: number;
  weight: number;
  message: string;
};

export type AssessmentWorkflowStep = {
  order: number;
  name: string;
  status: "pending" | "completed" | "failed";
};

export type AssessmentWorkflowResult = {
  status: string;
  score: number;
  steps: AssessmentWorkflowStep[];
  findings: Record<string, unknown>;
};

export const GovernanceFrameworkCatalog: Array<{
  id: GovernanceFramework;
  name: string;
  description: string;
  version: string;
}> = [
  {
    id: GovernanceFrameworks.soc2,
    name: "SOC 2",
    description: "Trust Services Criteria for security and availability.",
    version: "2017",
  },
  {
    id: GovernanceFrameworks.iso27001,
    name: "ISO 27001",
    description: "Information security management system controls.",
    version: "2022",
  },
  {
    id: GovernanceFrameworks.gdpr,
    name: "GDPR",
    description: "EU data protection and privacy obligations.",
    version: "2016/679",
  },
  {
    id: GovernanceFrameworks.hipaa,
    name: "HIPAA",
    description: "US health information privacy and security safeguards.",
    version: "Security Rule",
  },
  {
    id: GovernanceFrameworks.nist,
    name: "NIST",
    description: "NIST Cybersecurity Framework control families.",
    version: "CSF 2.0",
  },
  {
    id: GovernanceFrameworks.pci_dss,
    name: "PCI DSS",
    description: "Payment card industry data security standards.",
    version: "4.0",
  },
];

/** Built-in control library across supported frameworks. */
export const GovernanceControlCatalog: ControlDefinition[] = [
  {
    key: "soc2.access_control",
    framework: GovernanceFrameworks.soc2,
    title: "Logical access controls",
    description: "Access is provisioned, reviewed, and revoked on a schedule.",
    category: "access",
    weight: 1.2,
  },
  {
    key: "soc2.change_management",
    framework: GovernanceFrameworks.soc2,
    title: "Change management",
    description: "Production changes follow documented approval workflows.",
    category: "operations",
    weight: 1,
  },
  {
    key: "iso27001.risk_assessment",
    framework: GovernanceFrameworks.iso27001,
    title: "Information security risk assessment",
    description: "Risks are identified, scored, and treated periodically.",
    category: "risk",
    weight: 1.3,
  },
  {
    key: "iso27001.asset_inventory",
    framework: GovernanceFrameworks.iso27001,
    title: "Asset inventory",
    description: "Information assets are inventoried and classified.",
    category: "assets",
    weight: 1,
  },
  {
    key: "gdpr.lawful_basis",
    framework: GovernanceFrameworks.gdpr,
    title: "Lawful basis for processing",
    description: "Personal data processing has documented lawful basis.",
    category: "privacy",
    weight: 1.2,
  },
  {
    key: "gdpr.dsar",
    framework: GovernanceFrameworks.gdpr,
    title: "Data subject request handling",
    description: "DSARs are tracked and fulfilled within statutory timelines.",
    category: "privacy",
    weight: 1.1,
  },
  {
    key: "hipaa.access_logging",
    framework: GovernanceFrameworks.hipaa,
    title: "PHI access logging",
    description: "Access to PHI is logged and reviewed.",
    category: "health",
    weight: 1.2,
  },
  {
    key: "nist.identify",
    framework: GovernanceFrameworks.nist,
    title: "Identify — asset & risk governance",
    description: "Organizational context, assets, and risks are governed.",
    category: "identify",
    weight: 1,
  },
  {
    key: "nist.protect",
    framework: GovernanceFrameworks.nist,
    title: "Protect — safeguards",
    description: "Protective technology and awareness controls are in place.",
    category: "protect",
    weight: 1.1,
  },
  {
    key: "pci.cardholder_data",
    framework: GovernanceFrameworks.pci_dss,
    title: "Cardholder data protection",
    description: "CHD is encrypted in transit and at rest where stored.",
    category: "payments",
    weight: 1.4,
  },
  {
    key: "pci.network_segmentation",
    framework: GovernanceFrameworks.pci_dss,
    title: "Network segmentation",
    description: "CDE is segmented from non-cardholder networks.",
    category: "payments",
    weight: 1.2,
  },
];

/** Signal keys expected for control evaluation (0..1 or count). */
export const defaultControlSignals = (): ControlSignalMap => ({
  accessReviewsComplete: 0,
  changeApprovalsEnforced: 0,
  riskRegisterPresent: 0,
  assetInventoryCoverage: 0,
  lawfulBasisDocumented: 0,
  dsarProcessPresent: 0,
  phiAccessLogging: 0,
  nistIdentifyMaturity: 0,
  nistProtectMaturity: 0,
  cardDataEncrypted: 0,
  networkSegmented: 0,
});

const CONTROL_SIGNAL_THRESHOLDS: Record<string, { signal: string; min: number }> = {
  "soc2.access_control": { signal: "accessReviewsComplete", min: 1 },
  "soc2.change_management": { signal: "changeApprovalsEnforced", min: 1 },
  "iso27001.risk_assessment": { signal: "riskRegisterPresent", min: 1 },
  "iso27001.asset_inventory": { signal: "assetInventoryCoverage", min: 0.7 },
  "gdpr.lawful_basis": { signal: "lawfulBasisDocumented", min: 1 },
  "gdpr.dsar": { signal: "dsarProcessPresent", min: 1 },
  "hipaa.access_logging": { signal: "phiAccessLogging", min: 1 },
  "nist.identify": { signal: "nistIdentifyMaturity", min: 0.6 },
  "nist.protect": { signal: "nistProtectMaturity", min: 0.6 },
  "pci.cardholder_data": { signal: "cardDataEncrypted", min: 1 },
  "pci.network_segmentation": { signal: "networkSegmented", min: 1 },
};

export function listControlsForFramework(framework?: string): ControlDefinition[] {
  if (!framework) return [...GovernanceControlCatalog];
  return GovernanceControlCatalog.filter((c) => c.framework === framework);
}

export function evaluateControl(
  control: ControlDefinition,
  signals: ControlSignalMap,
): ControlEvaluation {
  const threshold = CONTROL_SIGNAL_THRESHOLDS[control.key];
  const value = threshold ? (signals[threshold.signal] ?? 0) : 0;
  const passed = threshold ? value >= threshold.min : false;
  return {
    controlKey: control.key,
    framework: control.framework,
    title: control.title,
    passed,
    score: passed ? 1 : 0,
    weight: control.weight,
    message: passed
      ? "Control evidence meets threshold"
      : `Signal ${threshold?.signal ?? "unknown"} below required ${threshold?.min ?? 0}`,
  };
}

export function evaluateControlCatalog(input: {
  framework?: string;
  signals: ControlSignalMap;
}): {
  evaluations: ControlEvaluation[];
  coverageScore: number;
  passed: number;
  failed: number;
} {
  const controls = listControlsForFramework(input.framework);
  const evaluations = controls.map((c) => evaluateControl(c, input.signals));
  const weightSum = evaluations.reduce((s, e) => s + e.weight, 0) || 1;
  const coverageScore = Number(
    (evaluations.reduce((s, e) => s + e.score * e.weight, 0) / weightSum).toFixed(3),
  );
  return {
    evaluations,
    coverageScore,
    passed: evaluations.filter((e) => e.passed).length,
    failed: evaluations.filter((e) => !e.passed).length,
  };
}

/** Assessment workflow: plan → evidence → evaluate → decide → record. */
export function buildAssessmentWorkflow(): AssessmentWorkflowStep[] {
  return [
    { order: 1, name: "scope_control", status: "pending" },
    { order: 2, name: "collect_evidence", status: "pending" },
    { order: 3, name: "evaluate_control", status: "pending" },
    { order: 4, name: "decide_outcome", status: "pending" },
    { order: 5, name: "record_assessment", status: "pending" },
  ];
}

export function runAssessmentWorkflow(input: {
  control: ControlDefinition;
  signals: ControlSignalMap;
  waive?: boolean;
}): AssessmentWorkflowResult {
  const steps = buildAssessmentWorkflow().map((s) => ({
    ...s,
    status: "completed" as const,
  }));
  if (input.waive) {
    return {
      status: GovernanceAssessmentStatuses.waived,
      score: 0.5,
      steps,
      findings: { waived: true, controlKey: input.control.key },
    };
  }
  const evaluation = evaluateControl(input.control, input.signals);
  return {
    status: evaluation.passed
      ? GovernanceAssessmentStatuses.passed
      : GovernanceAssessmentStatuses.failed,
    score: evaluation.score,
    steps,
    findings: {
      controlKey: evaluation.controlKey,
      message: evaluation.message,
      passed: evaluation.passed,
    },
  };
}

export function buildExecutiveSummary(input: {
  frameworksCovered: number;
  frameworksTotal: number;
  activePolicies: number;
  riskPortfolioScore: number;
  controlCoverageScore: number;
  openCriticalRisks: number;
  assessmentsPassed: number;
  assessmentsTotal: number;
}): {
  score: number;
  grade: "strong" | "adequate" | "weak" | "critical";
  highlights: string[];
} {
  const frameworkCoverage =
    input.frameworksTotal === 0 ? 0 : input.frameworksCovered / input.frameworksTotal;
  const assessmentRate =
    input.assessmentsTotal === 0 ? 0.5 : input.assessmentsPassed / input.assessmentsTotal;
  const policyPresence = input.activePolicies > 0 ? 1 : 0.3;
  const criticalPenalty = Math.min(0.4, input.openCriticalRisks * 0.1);

  const score = Number(
    Math.max(
      0,
      frameworkCoverage * 0.2 +
        input.riskPortfolioScore * 0.25 +
        input.controlCoverageScore * 0.25 +
        assessmentRate * 0.15 +
        policyPresence * 0.15 -
        criticalPenalty,
    ).toFixed(3),
  );

  const grade =
    score >= 0.85 ? "strong" : score >= 0.65 ? "adequate" : score >= 0.4 ? "weak" : "critical";

  const highlights: string[] = [];
  if (input.activePolicies === 0) highlights.push("No active governance policies");
  if (input.openCriticalRisks > 0)
    highlights.push(`${input.openCriticalRisks} critical open risk(s)`);
  if (input.controlCoverageScore < 0.6) highlights.push("Control coverage below target");
  if (highlights.length === 0) highlights.push("Governance posture within executive targets");

  return { score, grade, highlights };
}
