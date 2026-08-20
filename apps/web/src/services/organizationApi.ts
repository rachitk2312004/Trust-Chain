import { apiClient } from "./http";
import type {
  Branch,
  Department,
  DiscoverableOrganization,
  InviteRoleKey,
  LogoUploadUrlResponse,
  MembershipJoinRequest,
  OrganizationBranding,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationSummary,
} from "../types/api";

export type CreateOrganizationInput = {
  name: string;
  slug?: string;
  parentOrganizationId?: string;
};

export type UpdateOrganizationInput = {
  name?: string;
  status?: "active" | "disabled";
  parentOrganizationId?: string | null;
};

export type BranchInput = {
  name: string;
  code?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

export type DepartmentInput = {
  name: string;
  code?: string;
  branchId?: string;
};

export type InviteMemberInput = {
  email: string;
  roleKey: InviteRoleKey;
  branchId?: string;
  departmentId?: string;
};

export type UpdateMemberInput = {
  title?: string;
  status?: "active" | "disabled" | "suspended";
  branchId?: string | null;
  departmentId?: string | null;
};

export type MemberRoleKey = "org_admin" | "employee" | "public_user";

export type BrandingInput = {
  displayName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoObjectKey?: string;
};

export const organizationApi = {
  list() {
    return apiClient.get<{ organizations: OrganizationSummary[] }>("/organizations");
  },
  workspaceContext() {
    return apiClient.get<{
      organizations: OrganizationSummary[];
      joinRequests: MembershipJoinRequest[];
    }>("/organizations/workspace-context");
  },
  discover(q = "") {
    return apiClient.get<{ organizations: DiscoverableOrganization[] }>("/organizations/discover", {
      params: { q },
    });
  },
  listMyJoinRequests() {
    return apiClient.get<{ requests: MembershipJoinRequest[] }>("/organizations/join-requests/mine");
  },
  createJoinRequest(
    organizationId: string,
    body: { message?: string; requestedRole?: "employee" | "public_user" },
  ) {
    return apiClient.post<{ request: MembershipJoinRequest }>(
      `/organizations/${organizationId}/join-requests`,
      body,
    );
  },
  listJoinRequests(organizationId: string) {
    return apiClient.get<{ requests: MembershipJoinRequest[] }>(
      `/organizations/${organizationId}/join-requests`,
    );
  },
  approveJoinRequest(
    organizationId: string,
    requestId: string,
    body?: { roleKey?: MemberRoleKey; reviewNote?: string },
  ) {
    return apiClient.post<{ request: MembershipJoinRequest }>(
      `/organizations/${organizationId}/join-requests/${requestId}/approve`,
      body ?? {},
    );
  },
  rejectJoinRequest(organizationId: string, requestId: string, body?: { reviewNote?: string }) {
    return apiClient.post<{ request: MembershipJoinRequest }>(
      `/organizations/${organizationId}/join-requests/${requestId}/reject`,
      body ?? {},
    );
  },
  get(organizationId: string) {
    return apiClient.get<{ organization: OrganizationSummary }>(`/organizations/${organizationId}`);
  },
  getOverview(organizationId: string) {
    return apiClient.get<{
      organization: OrganizationSummary;
      stats: {
        memberCount: number;
        branchCount: number;
        departmentCount: number;
        pendingJoinCount: number;
      };
    }>(`/organizations/${organizationId}/overview`);
  },
  create(body: CreateOrganizationInput) {
    return apiClient.post<{ organization: OrganizationSummary }>("/organizations", body);
  },
  update(organizationId: string, body: UpdateOrganizationInput) {
    return apiClient.patch<{ organization: OrganizationSummary }>(
      `/organizations/${organizationId}`,
      body,
    );
  },
  listMembers(organizationId: string) {
    return apiClient.get<{ members: OrganizationMember[] }>(
      `/organizations/${organizationId}/members`,
    );
  },
  updateMember(organizationId: string, membershipId: string, body: UpdateMemberInput) {
    return apiClient.patch<{ ok: boolean }>(
      `/organizations/${organizationId}/members/${membershipId}`,
      body,
    );
  },
  updateMemberRole(organizationId: string, membershipId: string, roleKey: MemberRoleKey) {
    return apiClient.patch<{ ok: boolean; roleKey: MemberRoleKey }>(
      `/organizations/${organizationId}/members/${membershipId}/role`,
      { roleKey },
    );
  },
  listInvitations(organizationId: string) {
    return apiClient.get<{ invitations: OrganizationInvitation[] }>(
      `/organizations/${organizationId}/invitations`,
    );
  },
  inviteMember(organizationId: string, body: InviteMemberInput) {
    return apiClient.post<{
      invitation: Pick<OrganizationInvitation, "id" | "email" | "roleKey" | "expiresAt">;
    }>(`/organizations/${organizationId}/invitations`, body);
  },
  acceptInvitation(token: string) {
    return apiClient.post<{ organizationId: string; roleKey: string }>("/invitations/accept", {
      token,
    });
  },
  listBranches(organizationId: string) {
    return apiClient.get<{ branches: Branch[] }>(`/organizations/${organizationId}/branches`);
  },
  createBranch(organizationId: string, body: BranchInput) {
    return apiClient.post<{ branch: Branch }>(`/organizations/${organizationId}/branches`, body);
  },
  updateBranch(organizationId: string, branchId: string, body: Partial<BranchInput>) {
    return apiClient.patch<{ branch: Branch }>(
      `/organizations/${organizationId}/branches/${branchId}`,
      body,
    );
  },
  deleteBranch(organizationId: string, branchId: string) {
    return apiClient.delete<{ ok: boolean }>(
      `/organizations/${organizationId}/branches/${branchId}`,
    );
  },
  listDepartments(organizationId: string) {
    return apiClient.get<{ departments: Department[] }>(
      `/organizations/${organizationId}/departments`,
    );
  },
  createDepartment(organizationId: string, body: DepartmentInput) {
    return apiClient.post<{ department: Department }>(
      `/organizations/${organizationId}/departments`,
      body,
    );
  },
  updateDepartment(organizationId: string, departmentId: string, body: Partial<DepartmentInput>) {
    return apiClient.patch<{ department: Department }>(
      `/organizations/${organizationId}/departments/${departmentId}`,
      body,
    );
  },
  deleteDepartment(organizationId: string, departmentId: string) {
    return apiClient.delete<{ ok: boolean }>(
      `/organizations/${organizationId}/departments/${departmentId}`,
    );
  },
  getBranding(organizationId: string) {
    return apiClient.get<{ branding: OrganizationBranding | null }>(
      `/organizations/${organizationId}/branding`,
    );
  },
  updateBranding(organizationId: string, body: BrandingInput) {
    return apiClient.put<{ branding: OrganizationBranding }>(
      `/organizations/${organizationId}/branding`,
      body,
    );
  },
  createLogoUploadUrl(
    organizationId: string,
    contentType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml",
  ) {
    return apiClient.post<LogoUploadUrlResponse>(
      `/organizations/${organizationId}/branding/logo-upload-url`,
      { contentType },
    );
  },
};
