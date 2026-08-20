import { apiClient } from "./http";

export type OrgDepartment = {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  parentDepartmentId: string | null;
  businessUnitId: string | null;
  costCenterId: string | null;
  ownerUserId: string | null;
  policy: Record<string, unknown>;
  status: string;
};

export type OrgBusinessUnit = {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string | null;
  parentUnitId: string | null;
  ownerUserId: string | null;
  policy: Record<string, unknown>;
  status: string;
};

export type OrgHierarchyNode = {
  id: string;
  key: string;
  name: string;
  type: string;
  parentId: string | null;
  children?: OrgHierarchyNode[];
};

export type OrgApproval = {
  id: string;
  name: string;
  resourceType: string;
  status: string;
  steps: Array<{
    id?: string;
    stepOrder: number;
    approverType: string;
    approverRef: string;
    name: string | null;
  }>;
};

export type OrgPlatformDashboard = {
  organization: { id: string; name: string; slug: string } | null;
  departments: OrgDepartment[];
  businessUnits: OrgBusinessUnit[];
  costCenters: Array<{
    id: string;
    code: string;
    name: string;
    allocationPct: number;
    businessUnitId: string | null;
  }>;
  approvals: OrgApproval[];
  report: {
    departments: number;
    businessUnits: number;
    costCenters: number;
    approvalWorkflows: number;
    ownedDepartments: number;
    allocationTotal: number;
    coverage: number;
  };
};

export const organizationPlatformApi = {
  get(organizationId: string) {
    return apiClient.get<OrgPlatformDashboard>("/organization", {
      params: { organizationId },
    });
  },

  createDepartment(body: Record<string, unknown>) {
    return apiClient.post<{ department: OrgDepartment }>("/organization/departments", body);
  },

  patchDepartment(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ department: OrgDepartment }>(`/organization/departments/${id}`, body);
  },

  createBusinessUnit(body: Record<string, unknown>) {
    return apiClient.post<{ businessUnit: OrgBusinessUnit; costCenter: unknown }>(
      "/organization/business-units",
      body,
    );
  },

  patchBusinessUnit(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ businessUnit: OrgBusinessUnit }>(
      `/organization/business-units/${id}`,
      body,
    );
  },

  hierarchy(organizationId: string) {
    return apiClient.get<{
      tree: OrgHierarchyNode[];
      inheritance: Array<{
        departmentId: string;
        name: string;
        inheritedPolicy: Record<string, unknown>;
        chain: string[];
      }>;
      counts: { businessUnits: number; departments: number; costCenters: number };
    }>("/organization/hierarchy", { params: { organizationId } });
  },

  createApproval(body: Record<string, unknown>) {
    return apiClient.post<{
      workflow: OrgApproval;
      chain: unknown;
      progress: { nextStepOrder: number | null; completed: boolean; pendingCount: number };
    }>("/organization/approvals", body);
  },
};
