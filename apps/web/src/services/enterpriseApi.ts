import { apiClient } from "./http";

export type EnterpriseSaml = {
  id: string;
  organizationId: string;
  status: string;
  entityId: string;
  acsUrl: string;
  idpEntityId: string;
  idpSsoUrl: string;
  attributeMapping: unknown;
  metadataXml: string | null;
};

export type EnterpriseScim = {
  id: string;
  organizationId: string;
  status: string;
  baseUrl: string;
  tokenHint: string;
  userMapping: unknown;
};

export type EnterpriseRole = {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string | null;
  parentRoleId: string | null;
  permissions: string[];
  inheritedPermissions?: string[];
  ancestors?: string[];
  status: string;
};

export type AccessReview = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  summary: {
    total: number;
    pending: number;
    approved: number;
    revoked: number;
    complete: boolean;
  };
  items: Array<{
    id: string;
    subjectUserId: string;
    roleKey: string;
    decision: string;
    notes: string | null;
  }>;
  createdAt: string;
};

export type EnterpriseDashboard = {
  organizationId: string;
  saml: EnterpriseSaml | null;
  scim: EnterpriseScim | null;
  roles: EnterpriseRole[];
  abacPolicies: Array<{
    id: string;
    name: string;
    effect: string;
    priority: number;
    status: string;
  }>;
  delegates: Array<{
    id: string;
    delegateUserId: string;
    scope: string[];
    status: string;
  }>;
  accessReviews: AccessReview[];
};

export const enterpriseApi = {
  get(organizationId: string) {
    return apiClient.get<EnterpriseDashboard>("/enterprise", {
      params: { organizationId },
    });
  },

  upsertSaml(body: Record<string, unknown>) {
    return apiClient.post<{ saml: EnterpriseSaml; accessReview: unknown }>(
      "/enterprise/saml",
      body,
    );
  },

  upsertScim(body: Record<string, unknown>) {
    return apiClient.post<{
      scim: EnterpriseScim;
      bearerToken: string | null;
      provision: unknown;
    }>("/enterprise/scim", body);
  },

  listRoles(params: { organizationId: string }) {
    return apiClient.get<{ roles: EnterpriseRole[]; total: number }>("/enterprise/roles", {
      params,
    });
  },

  createRole(body: Record<string, unknown>) {
    return apiClient.post<{ role: EnterpriseRole }>("/enterprise/roles", body);
  },

  patchRole(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ role: EnterpriseRole }>(`/enterprise/roles/${id}`, body);
  },
};
