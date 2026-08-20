import { RoleKeys } from "@trustchain/config";

export type RoleBinding = {
  roleKey: string;
  roleName: string;
  organizationId: string | null;
};

export type OrgCapability =
  | "org.view"
  | "org.create"
  | "org.update"
  | "org.disable"
  | "org.branding"
  | "org.invite"
  | "org.members.manage"
  | "org.branches.manage"
  | "org.departments.manage"
  | "documents.view"
  | "documents.upload"
  | "documents.share"
  | "documents.archive"
  | "documents.manage"
  | "verification.run"
  | "verification.view"
  | "qr.view"
  | "qr.manage"
  | "qr.analytics"
  | "certificates.view"
  | "certificates.manage"
  | "certificates.issue"
  | "certificates.own.view"
  | "certificates.own.share"
  | "signatures.view"
  | "signatures.create"
  | "signatures.verify"
  | "signatures.manage"
  | "admin.view"
  | "admin.manage";

const ORG_ADMIN_KEYS = new Set<string>([RoleKeys.orgAdmin]);
const MEMBER_KEYS = new Set<string>([RoleKeys.orgAdmin, RoleKeys.employee]);

function rolesForOrg(roles: RoleBinding[], organizationId: string | null | undefined): RoleBinding[] {
  if (!organizationId) {
    return roles.filter((r) => r.organizationId == null || r.roleKey === RoleKeys.superAdmin);
  }
  return roles.filter(
    (r) => r.roleKey === RoleKeys.superAdmin || r.organizationId === organizationId,
  );
}

export function isSuperAdmin(roles: RoleBinding[]): boolean {
  return roles.some((r) => r.roleKey === RoleKeys.superAdmin);
}

/** Super admin with no org_admin binding — platform console only. */
export function isPlatformAdminOnly(roles: RoleBinding[]): boolean {
  return (
    isSuperAdmin(roles) &&
    !roles.some((r) => r.roleKey === RoleKeys.orgAdmin && r.organizationId != null)
  );
}

/** Super admin or org admin in any organization (notification ops dashboards). */
export function isOpsAdmin(roles: RoleBinding[]): boolean {
  if (isSuperAdmin(roles)) return true;
  return roles.some((r) => r.roleKey === RoleKeys.orgAdmin);
}

export function isOrgAdmin(roles: RoleBinding[], organizationId: string | null | undefined): boolean {
  return rolesForOrg(roles, organizationId).some((r) => ORG_ADMIN_KEYS.has(r.roleKey));
}

export function isOrgMember(roles: RoleBinding[], organizationId: string | null | undefined): boolean {
  return rolesForOrg(roles, organizationId).some((r) => MEMBER_KEYS.has(r.roleKey));
}

/** Holder wallet / public verify UX — hidden for platform and org administrators. */
export function showHolderFeatures(
  roles: RoleBinding[],
  organizationId?: string | null,
): boolean {
  if (isSuperAdmin(roles)) return false;
  if (isOrgAdmin(roles, organizationId)) return false;
  return true;
}

/** Hide redundant public_user when staff roles are present. */
export function rolesForDisplay(roles: RoleBinding[]): RoleBinding[] {
  const hasStaff = roles.some((r) => MEMBER_KEYS.has(r.roleKey) || r.roleKey === RoleKeys.superAdmin);
  if (!hasStaff) return roles;
  return roles.filter((r) => r.roleKey !== RoleKeys.publicUser);
}

export function can(roles: RoleBinding[], capability: OrgCapability, organizationId?: string | null): boolean {
  const admin = isOrgAdmin(roles, organizationId) || isSuperAdmin(roles);
  const member = isOrgMember(roles, organizationId) || isSuperAdmin(roles);

  switch (capability) {
    case "org.create":
      return isSuperAdmin(roles);
    case "org.view":
    case "documents.view":
    case "verification.view":
    case "verification.run":
    case "qr.view":
    case "certificates.view":
    case "certificates.issue":
    case "signatures.view":
    case "signatures.create":
    case "signatures.verify":
      return member;
    case "org.update":
    case "org.disable":
    case "org.branding":
    case "org.invite":
    case "org.members.manage":
    case "org.branches.manage":
    case "org.departments.manage":
    case "documents.manage":
    case "qr.manage":
    case "qr.analytics":
    case "certificates.manage":
    case "signatures.manage":
      return admin;
    case "admin.view":
    case "admin.manage":
      return isSuperAdmin(roles);
    case "documents.upload":
    case "documents.share":
    case "documents.archive":
      return member;
    case "certificates.own.view":
    case "certificates.own.share":
      return true;
    default:
      return false;
  }
}

export function documentActionAllowed(
  permission: "view" | "download" | "edit" | "manage" | undefined,
  action: "view" | "download" | "edit" | "share" | "archive" | "manage",
): boolean {
  const rank: Record<string, number> = {
    view: 1,
    download: 2,
    edit: 3,
    manage: 4,
  };
  const have = rank[permission ?? "view"] ?? 0;
  const need =
    action === "view"
      ? 1
      : action === "download"
        ? 2
        : action === "edit" || action === "share" || action === "archive"
          ? 3
          : 4;
  return have >= need;
}
