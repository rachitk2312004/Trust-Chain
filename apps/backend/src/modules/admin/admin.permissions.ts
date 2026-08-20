import { AdminCapabilities, RoleKeys } from "@trustchain/config";

export type AdminCapability = (typeof AdminCapabilities)[keyof typeof AdminCapabilities];

export type PermissionCatalogEntry = {
  key: AdminCapability;
  name: string;
  description: string;
  category: "platform" | "users" | "organizations" | "tenants" | "rbac" | "config" | "features" | "policies" | "analytics" | "operations" | "audit";
};
export type RoleCapabilityMatrix = Record<string, AdminCapability[]>;

export const ADMIN_PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  {
    key: AdminCapabilities.adminView,
    name: "View admin console",
    description: "Access the administration dashboard",
    category: "platform",
  },
  {
    key: AdminCapabilities.adminManage,
    name: "Manage admin console",
    description: "Full administration platform access",
    category: "platform",
  },
  {
    key: AdminCapabilities.usersView,
    name: "View users",
    description: "List and inspect platform users",
    category: "users",
  },
  {
    key: AdminCapabilities.usersManage,
    name: "Manage users",
    description: "Assign and revoke user roles",
    category: "users",
  },
  {
    key: AdminCapabilities.organizationsView,
    name: "View organizations",
    description: "List and inspect organizations",
    category: "organizations",
  },
  {
    key: AdminCapabilities.organizationsManage,
    name: "Manage organizations",
    description: "Inspect organization structure and membership",
    category: "organizations",
  },
  {
    key: AdminCapabilities.tenantsView,
    name: "View tenants",
    description: "List and inspect tenants",
    category: "tenants",
  },
  {
    key: AdminCapabilities.tenantsManage,
    name: "Manage tenants",
    description: "Create, suspend, restore, archive, and transfer tenants",
    category: "tenants",
  },
  {
    key: AdminCapabilities.rolesManage,
    name: "Manage roles",
    description: "Assign and revoke role bindings",
    category: "rbac",
  },
  {
    key: AdminCapabilities.permissionsManage,
    name: "Manage permissions",
    description: "Assign capabilities to roles",
    category: "rbac",
  },
  {
    key: AdminCapabilities.configurationManage,
    name: "Manage configuration",
    description: "Update system configuration keys",
    category: "config",
  },
  {
    key: AdminCapabilities.featureFlagsManage,
    name: "Manage feature flags",
    description: "Create and update feature flags",
    category: "features",
  },
  {
    key: AdminCapabilities.policiesView,
    name: "View policies",
    description: "List and inspect administration policies",
    category: "policies",
  },
  {
    key: AdminCapabilities.policiesManage,
    name: "Manage policies",
    description: "Create, assign, evaluate, and delete policies",
    category: "policies",
  },
  {
    key: AdminCapabilities.analyticsView,
    name: "View analytics",
    description: "View administration analytics and metrics",
    category: "analytics",
  },
  {
    key: AdminCapabilities.operationsManage,
    name: "Manage operations",
    description: "Run administration reprocess and retention cleanup",
    category: "operations",
  },
  {
    key: AdminCapabilities.auditView,
    name: "View audit log",
    description: "Read administration audit events",
    category: "audit",
  },
];

/** Default role → capability grants (code catalog; overridable via SystemConfiguration). */
export const DEFAULT_ROLE_CAPABILITIES: RoleCapabilityMatrix = {
  [RoleKeys.superAdmin]: [...Object.values(AdminCapabilities)],
  [RoleKeys.orgAdmin]: [
    AdminCapabilities.adminView,
    AdminCapabilities.usersView,
    AdminCapabilities.organizationsView,
    AdminCapabilities.auditView,
  ],
  [RoleKeys.employee]: [],
  [RoleKeys.publicUser]: [],
};

export function isKnownCapability(key: string): key is AdminCapability {
  return ADMIN_PERMISSION_CATALOG.some((entry) => entry.key === key);
}

export function normalizeCapabilities(capabilities: string[]): AdminCapability[] {
  const unique = new Set<AdminCapability>();
  for (const key of capabilities) {
    if (isKnownCapability(key)) unique.add(key);
  }
  return [...unique].sort();
}

export function assignPermission(
  matrix: RoleCapabilityMatrix,
  roleKey: string,
  capability: string,
): RoleCapabilityMatrix {
  if (!isKnownCapability(capability)) {
    throw new Error(`Unknown capability: ${capability}`);
  }
  const current = matrix[roleKey] ?? [];
  if (current.includes(capability)) return { ...matrix, [roleKey]: [...current] };
  return {
    ...matrix,
    [roleKey]: normalizeCapabilities([...current, capability]),
  };
}

export function revokePermission(
  matrix: RoleCapabilityMatrix,
  roleKey: string,
  capability: string,
): RoleCapabilityMatrix {
  const current = matrix[roleKey] ?? [];
  return {
    ...matrix,
    [roleKey]: current.filter((c) => c !== capability),
  };
}

export function mergeRoleCapabilityOverrides(
  defaults: RoleCapabilityMatrix,
  overrides: RoleCapabilityMatrix | null | undefined,
): RoleCapabilityMatrix {
  if (!overrides || typeof overrides !== "object") {
    return Object.fromEntries(
      Object.entries(defaults).map(([role, caps]) => [role, normalizeCapabilities(caps)]),
    );
  }
  const roles = new Set([...Object.keys(defaults), ...Object.keys(overrides)]);
  const merged: RoleCapabilityMatrix = {};
  for (const role of roles) {
    if (Object.prototype.hasOwnProperty.call(overrides, role)) {
      merged[role] = normalizeCapabilities(overrides[role] ?? []);
    } else {
      merged[role] = normalizeCapabilities(defaults[role] ?? []);
    }
  }
  return merged;
}

export function roleHasCapability(
  matrix: RoleCapabilityMatrix,
  roleKey: string,
  capability: AdminCapability,
): boolean {
  return (matrix[roleKey] ?? []).includes(capability);
}

export function parseRoleCapabilityMatrix(value: unknown): RoleCapabilityMatrix | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: RoleCapabilityMatrix = {};
  for (const [roleKey, caps] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(caps)) continue;
    result[roleKey] = normalizeCapabilities(caps.filter((c): c is string => typeof c === "string"));
  }
  return result;
}
