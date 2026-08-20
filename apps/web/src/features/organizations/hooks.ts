import { organizationApi } from "../../services/organizationApi";
import { useSessionStore } from "../../lib/sessionStore";
import type {
  BranchInput,
  BrandingInput,
  CreateOrganizationInput,
  DepartmentInput,
  InviteMemberInput,
  UpdateMemberInput,
  UpdateOrganizationInput,
} from "../../services/organizationApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function orgKeys(organizationId?: string) {
  return {
    all: ["organizations"] as const,
    workspace: ["organizations", "workspace"] as const,
    detail: ["organizations", organizationId] as const,
    overview: ["organizations", organizationId, "overview"] as const,
    members: ["organizations", organizationId, "members"] as const,
    invitations: ["organizations", organizationId, "invitations"] as const,
    branches: ["organizations", organizationId, "branches"] as const,
    departments: ["organizations", organizationId, "departments"] as const,
    branding: ["organizations", organizationId, "branding"] as const,
    joinRequests: ["organizations", organizationId, "join-requests"] as const,
    myJoinRequests: ["organizations", "join-requests", "mine"] as const,
    discover: (q: string) => ["organizations", "discover", q] as const,
  };
}

function invalidateOrganizationWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: orgKeys().workspace });
  void queryClient.invalidateQueries({ queryKey: orgKeys().all });
  void queryClient.invalidateQueries({ queryKey: orgKeys().myJoinRequests });
}

/** Single request for org switcher: memberships + my join requests (deduped across hooks). */
export function useOrganizationWorkspace(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgKeys().workspace,
    queryFn: async () => {
      const { data } = await organizationApi.workspaceContext();
      return data;
    },
    enabled: enabled && Boolean(accessToken),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnMount: false,
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.hidden) return false;
      const pending = (query.state.data?.joinRequests ?? []).some((r) => r.status === "pending");
      return pending ? 60_000 : false;
    },
  });
}

export function useOrganizations(enabled = true) {
  const workspace = useOrganizationWorkspace(enabled);
  return {
    ...workspace,
    data: workspace.data?.organizations,
  };
}

export function useOrganization(organizationId: string | undefined, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgKeys(organizationId).detail,
    queryFn: async () => {
      const { data } = await organizationApi.get(organizationId!);
      return data.organization;
    },
    enabled: enabled && Boolean(accessToken) && Boolean(organizationId),
    staleTime: 2 * 60_000,
    refetchOnMount: false,
  });
}

export function useOrganizationOverview(organizationId: string | undefined, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: orgKeys(organizationId).overview,
    queryFn: async () => {
      const { data } = await organizationApi.getOverview(organizationId!);
      queryClient.setQueryData(orgKeys(organizationId).detail, data.organization);
      return data;
    },
    enabled: enabled && Boolean(accessToken) && Boolean(organizationId),
    staleTime: 60_000,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const setActive = useSessionStore((s) => s.setActiveOrganizationId);
  return useMutation({
    mutationFn: async (input: CreateOrganizationInput) => {
      const { data } = await organizationApi.create(input);
      return data.organization;
    },
    onSuccess: (organization) => {
      setActive(organization.id);
      void invalidateOrganizationWorkspace(queryClient);
    },
  });
}

export function useUpdateOrganization(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateOrganizationInput) => {
      const { data } = await organizationApi.update(organizationId, input);
      return data.organization;
    },
    onSuccess: () => {
      void invalidateOrganizationWorkspace(queryClient);
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).detail });
    },
  });
}

/** Soft-delete: PATCH status to disabled (no hard-delete endpoint). */
export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  const activeId = useSessionStore((s) => s.activeOrganizationId);
  const setActive = useSessionStore((s) => s.setActiveOrganizationId);
  return useMutation({
    mutationFn: async (organizationId: string) => {
      const { data } = await organizationApi.update(organizationId, { status: "disabled" });
      return data.organization;
    },
    onSuccess: (organization) => {
      if (activeId === organization.id) setActive(null);
      void invalidateOrganizationWorkspace(queryClient);
      void queryClient.invalidateQueries({ queryKey: orgKeys(organization.id).detail });
    },
  });
}

export function useOrganizationMembers(organizationId: string | undefined, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgKeys(organizationId).members,
    queryFn: async () => {
      const { data } = await organizationApi.listMembers(organizationId!);
      return data.members;
    },
    enabled: enabled && Boolean(accessToken) && Boolean(organizationId),
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useUpdateMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { membershipId: string } & UpdateMemberInput) => {
      const { membershipId, ...body } = input;
      await organizationApi.updateMember(organizationId, membershipId, body);
      return membershipId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).members });
    },
  });
}

export function useUpdateMemberRole(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { membershipId: string; roleKey: "org_admin" | "employee" | "public_user" }) => {
      const { data } = await organizationApi.updateMemberRole(
        organizationId,
        input.membershipId,
        input.roleKey,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).members });
    },
  });
}

export function useDiscoverOrganizations(query: string, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgKeys().discover(query),
    queryFn: async () => {
      const { data } = await organizationApi.discover(query);
      return data.organizations;
    },
    enabled: enabled && Boolean(accessToken),
    staleTime: 0,
    retry: 1,
  });
}

export function useCreateJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organizationId: string;
      message?: string;
      requestedRole?: "employee" | "public_user";
    }) => {
      const { organizationId, ...body } = input;
      const { data } = await organizationApi.createJoinRequest(organizationId, body);
      return data.request;
    },
    onSuccess: () => {
      invalidateOrganizationWorkspace(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["organizations", "discover"] });
    },
  });
}

export function useMyJoinRequests(enabled = true) {
  const workspace = useOrganizationWorkspace(enabled);
  return {
    ...workspace,
    data: workspace.data?.joinRequests,
  };
}

export function useOrganizationJoinRequests(organizationId: string | undefined, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgKeys(organizationId).joinRequests,
    queryFn: async () => {
      const { data } = await organizationApi.listJoinRequests(organizationId!);
      return data.requests;
    },
    enabled: enabled && Boolean(accessToken) && Boolean(organizationId),
    staleTime: 60_000,
  });
}

export function useApproveJoinRequest(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      roleKey?: "org_admin" | "employee" | "public_user";
      reviewNote?: string;
    }) => {
      const { requestId, ...body } = input;
      const { data } = await organizationApi.approveJoinRequest(organizationId, requestId, body);
      return data.request;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).joinRequests });
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).members });
      void invalidateOrganizationWorkspace(queryClient);
    },
  });
}

export function useRejectJoinRequest(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requestId: string; reviewNote?: string }) => {
      const { data } = await organizationApi.rejectJoinRequest(
        organizationId,
        input.requestId,
        { reviewNote: input.reviewNote },
      );
      return data.request;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).joinRequests });
    },
  });
}

export function useInviteMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteMemberInput) => {
      const { data } = await organizationApi.inviteMember(organizationId, input);
      return data.invitation;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).invitations });
    },
  });
}

export function useOrganizationInvitations(organizationId: string | undefined, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgKeys(organizationId).invitations,
    queryFn: async () => {
      const { data } = await organizationApi.listInvitations(organizationId!);
      return data.invitations;
    },
    enabled: enabled && Boolean(accessToken) && Boolean(organizationId),
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

/**
 * Backend has no invitation revoke route. Closest available action is disabling
 * an accepted member via PATCH /members/:id.
 */
export function useRevokeInvitation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { membershipId: string }) => {
      await organizationApi.updateMember(organizationId, input.membershipId, {
        status: "disabled",
      });
      return input.membershipId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).members });
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await organizationApi.acceptInvitation(token);
      return data;
    },
    onSuccess: (result) => {
      useSessionStore.getState().setActiveOrganizationId(result.organizationId);
      void invalidateOrganizationWorkspace(queryClient);
    },
  });
}

export function useBranches(organizationId: string | undefined, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgKeys(organizationId).branches,
    queryFn: async () => {
      const { data } = await organizationApi.listBranches(organizationId!);
      return data.branches;
    },
    enabled: enabled && Boolean(accessToken) && Boolean(organizationId),
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useCreateBranch(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BranchInput) => {
      const { data } = await organizationApi.createBranch(organizationId, input);
      return data.branch;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).branches });
    },
  });
}

export function useUpdateBranch(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { branchId: string } & Partial<BranchInput>) => {
      const { branchId, ...body } = input;
      const { data } = await organizationApi.updateBranch(organizationId, branchId, body);
      return data.branch;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).branches });
    },
  });
}

export function useDeleteBranch(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (branchId: string) => {
      await organizationApi.deleteBranch(organizationId, branchId);
      return branchId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).branches });
    },
  });
}

export function useDepartments(organizationId: string | undefined, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgKeys(organizationId).departments,
    queryFn: async () => {
      const { data } = await organizationApi.listDepartments(organizationId!);
      return data.departments;
    },
    enabled: enabled && Boolean(accessToken) && Boolean(organizationId),
    staleTime: 60_000,
    refetchOnMount: false,
  });
}

export function useCreateDepartment(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DepartmentInput) => {
      const { data } = await organizationApi.createDepartment(organizationId, input);
      return data.department;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).departments });
    },
  });
}

export function useUpdateDepartment(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { departmentId: string } & Partial<DepartmentInput>) => {
      const { departmentId, ...body } = input;
      const { data } = await organizationApi.updateDepartment(organizationId, departmentId, body);
      return data.department;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).departments });
    },
  });
}

export function useDeleteDepartment(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (departmentId: string) => {
      await organizationApi.deleteDepartment(organizationId, departmentId);
      return departmentId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).departments });
    },
  });
}

export function useOrganizationBranding(organizationId: string | undefined, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgKeys(organizationId).branding,
    queryFn: async () => {
      const { data } = await organizationApi.getBranding(organizationId!);
      return data.branding;
    },
    enabled: enabled && Boolean(accessToken) && Boolean(organizationId),
  });
}

export function useUpdateBranding(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BrandingInput) => {
      const { data } = await organizationApi.updateBranding(organizationId, input);
      return data.branding;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).branding });
    },
  });
}

export function useUploadLogo(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
      const contentType = file.type as (typeof allowed)[number];
      if (!allowed.includes(contentType)) {
        throw new Error("Logo must be PNG, JPEG, WebP, or SVG.");
      }
      const { data: upload } = await organizationApi.createLogoUploadUrl(
        organizationId,
        contentType,
      );
      const put = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "content-type": contentType },
        body: file,
      });
      if (!put.ok) throw new Error("Logo upload to storage failed.");
      const { data } = await organizationApi.updateBranding(organizationId, {
        logoObjectKey: upload.objectKey,
      });
      return { branding: data.branding, previewUrl: URL.createObjectURL(file) };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys(organizationId).branding });
    },
  });
}

export { orgKeys };
