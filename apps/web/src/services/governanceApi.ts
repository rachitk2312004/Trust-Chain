import { apiClient } from "./http";

export type GovernanceFramework = {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  controlCount: number;
};

export type GovernancePolicy = {
  id: string;
  organizationId: string;
  framework: string;
  key: string;
  title: string;
  description: string | null;
  status: string;
  ownerUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type GovernanceRisk = {
  id: string;
  organizationId: string;
  key: string;
  title: string;
  description: string | null;
  category: string;
  framework: string | null;
  likelihood: number;
  impact: number;
  residualLikelihood: number;
  residualImpact: number;
  inherentScore: number;
  residualScore: number;
  band: string;
  status: string;
  ownerUserId: string | null;
  controlKeys: string[];
  createdAt: string;
  updatedAt: string;
};

export type ControlAssessment = {
  id: string;
  framework: string;
  controlKey: string;
  controlTitle: string;
  status: string;
  score: number;
  assessedAt: string | null;
  createdAt: string;
};

export type ControlEvaluation = {
  controlKey: string;
  framework: string;
  title: string;
  passed: boolean;
  score: number;
  weight: number;
  message: string;
};

export type GovernanceDashboard = {
  organizationId: string;
  frameworks: GovernanceFramework[];
  policies: GovernancePolicy[];
  risks: GovernanceRisk[];
  assessments: ControlAssessment[];
  controlLibrary: {
    total: number;
    coverageScore: number;
    passed: number;
    failed: number;
    evaluations: ControlEvaluation[];
  };
  riskPortfolio: {
    openCount: number;
    averageResidual: number;
    maxResidual: number;
    criticalCount: number;
    portfolioScore: number;
  };
  executive: {
    latestScore: number | null;
    summary: {
      score: number;
      grade: string;
      highlights: string[];
    };
  };
};

export type ExecutiveReport = {
  id: string;
  score: number;
  summary: unknown;
  createdAt: string;
};

export const governanceApi = {
  dashboard(organizationId: string) {
    return apiClient.get<GovernanceDashboard>("/governance", {
      params: { organizationId },
    });
  },

  createPolicy(body: Record<string, unknown>) {
    return apiClient.post<{ policy: GovernancePolicy }>("/governance/policies", body);
  },

  patchPolicy(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ policy: GovernancePolicy }>(`/governance/policies/${id}`, body);
  },

  listRisks(params: {
    organizationId: string;
    status?: string;
    framework?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<{
      risks: GovernanceRisk[];
      total: number;
      portfolio: GovernanceDashboard["riskPortfolio"];
    }>("/governance/risks", { params });
  },

  createRisk(body: Record<string, unknown>) {
    return apiClient.post<{
      risk: GovernanceRisk;
      assessments: Array<{ id: string; controlKey: string; status: string; score: number }>;
    }>("/governance/risks", body);
  },

  patchRisk(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ risk: GovernanceRisk }>(`/governance/risks/${id}`, body);
  },

  reports(organizationId: string, params?: { limit?: number; offset?: number }) {
    return apiClient.get<{
      reports: ExecutiveReport[];
      latest: ExecutiveReport;
      total: number;
    }>("/governance/reports", {
      params: { organizationId, ...params },
    });
  },
};
