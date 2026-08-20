import { RoleKeys } from "@trustchain/config";
import { isOrgAdminOnly } from "./homeRoute";
import {
  isOrgMember,
  isSuperAdmin,
  showHolderFeatures,
  type RoleBinding,
} from "./permissions";

export type WorkspacePersonaKind =
  | "org_admin"
  | "employee"
  | "certificate_holder"
  | "workspace";

export type WorkspacePersona = {
  kind: WorkspacePersonaKind;
  /** Short label shown in the top bar (e.g. "Organization admin"). */
  title: string;
  /** Secondary line under the title. */
  subtitle: string;
  /** Sidebar header title (e.g. "Organization console"). */
  consoleTitle: string;
  /** Sidebar header subtitle. */
  consoleSubtitle: string;
  /** Tailwind classes for accent text in the top bar. */
  accentClass: string;
  /** Tailwind classes for sidebar icon background. */
  iconClass: string;
};

/** Certificate holder with no organization membership yet (join-request / invite flow). */
export function isCertificateHolderOnly(
  roles: RoleBinding[],
  organizationId?: string | null,
): boolean {
  if (!showHolderFeatures(roles, organizationId)) return false;
  const hasStaffOrgBinding = roles.some(
    (r) =>
      (r.roleKey === RoleKeys.orgAdmin || r.roleKey === RoleKeys.employee) &&
      Boolean(r.organizationId),
  );
  return !hasStaffOrgBinding;
}

/** Org admins manage a single organization — they must not join others via self-service. */
export function canSelfJoinOrganization(roles: RoleBinding[]): boolean {
  if (isSuperAdmin(roles)) return false;
  return !roles.some((r) => r.roleKey === RoleKeys.orgAdmin && r.organizationId);
}

function isEmployeePersona(
  roles: RoleBinding[],
  organizationId?: string | null,
): boolean {
  if (isSuperAdmin(roles) || isOrgAdminOnly(roles, organizationId)) return false;
  return roles.some(
    (r) => r.roleKey === RoleKeys.employee && (organizationId ? r.organizationId === organizationId : Boolean(r.organizationId)),
  );
}

export function getWorkspacePersona(
  roles: RoleBinding[],
  organizationId?: string | null,
): WorkspacePersona {
  if (isSuperAdmin(roles) && !roles.some((r) => r.roleKey === RoleKeys.orgAdmin && r.organizationId)) {
    return {
      kind: "workspace",
      title: "Platform administrator",
      subtitle: "Platform administration · no workspace tools",
      consoleTitle: "TrustChain",
      consoleSubtitle: "Platform administration",
      accentClass: "text-emerald-600 dark:text-emerald-400",
      iconClass: "bg-emerald-500/15 text-emerald-400",
    };
  }

  if (isOrgAdminOnly(roles, organizationId)) {
    return {
      kind: "org_admin",
      title: "Organization admin",
      subtitle: "Organization administration · manage your trust workspace",
      consoleTitle: "Organization console",
      consoleSubtitle: "Organization control plane",
      accentClass: "text-emerald-600 dark:text-emerald-400",
      iconClass: "bg-emerald-500/15 text-emerald-400",
    };
  }

  if (isEmployeePersona(roles, organizationId) && isOrgMember(roles, organizationId)) {
    return {
      kind: "employee",
      title: "Employee",
      subtitle: "Organization member · workspace tools",
      consoleTitle: "Employee workspace",
      consoleSubtitle: "Organization member tools",
      accentClass: "text-sky-600 dark:text-sky-400",
      iconClass: "bg-sky-500/15 text-sky-400",
    };
  }

  if (showHolderFeatures(roles, organizationId)) {
    return {
      kind: "certificate_holder",
      title: "Certificate holder",
      subtitle: "Personal trust wallet · verify and hold credentials",
      consoleTitle: "Certificate wallet",
      consoleSubtitle: "Holder workspace",
      accentClass: "text-violet-600 dark:text-violet-400",
      iconClass: "bg-violet-500/15 text-violet-400",
    };
  }

  return {
    kind: "workspace",
    title: "TrustChain",
    subtitle: "Enterprise trust cloud",
    consoleTitle: "TrustChain",
    consoleSubtitle: "Enterprise trust cloud",
    accentClass: "text-emerald-600 dark:text-emerald-400",
    iconClass: "bg-emerald-500/15 text-emerald-400",
  };
}
