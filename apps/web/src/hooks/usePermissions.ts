import { useMemo } from "react";
import {
  can,
  canReportBugs,
  canUsePlatformQueries,
  documentActionAllowed,
  isOpsAdmin,
  isOrgAdmin,
  isOrgAdminAnywhere,
  isOrgMember,
  isPlatformAdminOnly,
  isSuperAdmin,
  rolesForDisplay,
  showHolderFeatures,
  type OrgCapability,
} from "../lib/permissions";
import { useSessionStore } from "../lib/sessionStore";

export function usePermissions(organizationId?: string | null) {
  const roles = useSessionStore((s) => s.roles);
  const activeOrganizationId = useSessionStore((s) => s.activeOrganizationId);
  const orgId = organizationId === undefined ? activeOrganizationId : organizationId;

  return useMemo(() => {
    const check = (capability: OrgCapability) => can(roles, capability, orgId);
    return {
      roles,
      displayRoles: rolesForDisplay(roles),
      organizationId: orgId,
      isSuperAdmin: isSuperAdmin(roles),
      isPlatformAdminOnly: isPlatformAdminOnly(roles),
      isOpsAdmin: isOpsAdmin(roles),
      isOrgAdmin: isOrgAdmin(roles, orgId),
      isOrgAdminAnywhere: isOrgAdminAnywhere(roles),
      canUsePlatformQueries: canUsePlatformQueries(roles),
      canReportBugs: canReportBugs(roles),
      isOrgMember: isOrgMember(roles, orgId),
      showHolderFeatures: showHolderFeatures(roles, orgId),
      can: check,
      canDocument: documentActionAllowed,
    };
  }, [roles, orgId]);
}
