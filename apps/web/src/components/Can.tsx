import type { ReactNode } from "react";
import type { OrgCapability } from "../lib/permissions";
import { usePermissions } from "../hooks/usePermissions";

export function Can({
  capability,
  organizationId,
  children,
  fallback = null,
}: {
  capability: OrgCapability;
  organizationId?: string | null;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = usePermissions(organizationId);
  if (!can(capability)) return <>{fallback}</>;
  return <>{children}</>;
}
