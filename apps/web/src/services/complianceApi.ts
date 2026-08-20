import { apiClient } from "./http";

export const complianceApi = {
  dashboard(organizationId: string) {
    return apiClient.get<{
      organizationId: string;
      overallScore: number;
      frameworksCovered: number;
      openViolations: number;
      openRemediations: number;
      frameworks: Array<{
        id: string;
        name: string;
        description: string;
        version: string;
        ruleCount: number;
      }>;
      latestByFramework: Record<string, { score: number; assessmentId: string }>;
      recentAssessments: Array<{
        id: string;
        framework: string;
        score: number;
        status: string;
        finishedAt: string | null;
      }>;
      violations: Array<{
        id: string;
        framework: string;
        ruleKey: string;
        title: string;
        severity: string;
        status: string;
        detectedAt: string;
        remediations: Array<{
          id: string;
          title: string;
          status: string;
          dueAt: string | null;
          notes: string | null;
          completedAt: string | null;
        }>;
      }>;
    }>("/compliance", { params: { organizationId } });
  },

  frameworks(organizationId?: string) {
    return apiClient.get<{
      frameworks: Array<{
        id: string;
        name: string;
        description: string;
        version: string;
        ruleCount: number;
      }>;
    }>("/compliance/frameworks", { params: { organizationId } });
  },

  run(body: {
    organizationId: string;
    framework: string;
    scheduled?: boolean;
    signals?: Record<string, number>;
  }) {
    return apiClient.post<{
      assessment: { id: string; score: number; framework: string; status: string };
      score: { score: number; grade: string; passedRules: number; failedRules: number };
      report: { id: string; title: string; score: number };
    }>("/compliance/run", body);
  },

  get(id: string) {
    return apiClient.get<{
      assessment: {
        id: string;
        framework: string;
        score: number;
        status: string;
        summary: unknown;
      };
      ruleResults: Array<{
        ruleKey: string;
        title: string;
        passed: boolean;
        severity: string;
        message: string | null;
      }>;
      violations: Array<{
        id: string;
        title: string;
        status: string;
        remediations: Array<{
          id: string;
          title: string;
          status: string;
          dueAt: string | null;
          notes: string | null;
        }>;
      }>;
      reports: Array<{ id: string; title: string; score: number; createdAt: string }>;
    }>(`/compliance/${id}`);
  },

  reports(params: { organizationId: string; framework?: string; limit?: number }) {
    return apiClient.get<{
      reports: Array<{
        id: string;
        framework: string;
        title: string;
        score: number;
        status: string;
        report: Record<string, unknown>;
        createdAt: string;
      }>;
      total: number;
    }>("/compliance/reports", { params });
  },

  patchRemediation(
    id: string,
    body: { status?: string; notes?: string; ownerUserId?: string | null },
  ) {
    return apiClient.patch<{ remediation: Record<string, unknown> }>(
      `/compliance/remediations/${id}`,
      body,
    );
  },
};
