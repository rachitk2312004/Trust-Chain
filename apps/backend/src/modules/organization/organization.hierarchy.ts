import { OrgPlatformDefaults } from "@trustchain/config";

export type HierarchyNode = {
  id: string;
  key: string;
  name: string;
  parentId: string | null;
  type: "organization" | "business_unit" | "department" | "cost_center";
  ownerUserId?: string | null;
  policy?: Record<string, unknown>;
  children?: HierarchyNode[];
};

export type PolicyMap = Record<string, unknown>;

/** Deep-merge policies: ancestor first, descendant overrides. */
export function mergePolicies(...policies: PolicyMap[]): PolicyMap {
  const out: PolicyMap = {};
  for (const policy of policies) {
    for (const [k, v] of Object.entries(policy)) {
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        out[k] &&
        typeof out[k] === "object" &&
        !Array.isArray(out[k])
      ) {
        out[k] = mergePolicies(out[k] as PolicyMap, v as PolicyMap);
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}

export function buildTree(
  nodes: Array<Omit<HierarchyNode, "children">>,
  rootParentId: string | null = null,
): HierarchyNode[] {
  const byParent = new Map<string | null, Array<Omit<HierarchyNode, "children">>>();
  for (const node of nodes) {
    const key = node.parentId;
    const list = byParent.get(key) ?? [];
    list.push(node);
    byParent.set(key, list);
  }

  const walk = (parentId: string | null, depth: number): HierarchyNode[] => {
    if (depth > OrgPlatformDefaults.maxHierarchyDepth) return [];
    const children = byParent.get(parentId) ?? [];
    return children
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({
        ...n,
        children: walk(n.id, depth + 1),
      }));
  };

  return walk(rootParentId, 0);
}

export function resolveInheritedPolicy(
  nodes: Array<{ id: string; parentId: string | null; policy: PolicyMap }>,
  nodeId: string,
): { policy: PolicyMap; chain: string[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: string[] = [];
  const policies: PolicyMap[] = [];
  let current = byId.get(nodeId);
  let depth = 0;
  const seen = new Set<string>();
  while (current && depth < OrgPlatformDefaults.maxHierarchyDepth) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    chain.unshift(current.id);
    policies.unshift(current.policy);
    current = current.parentId ? byId.get(current.parentId) : undefined;
    depth += 1;
  }
  return { policy: mergePolicies(...policies), chain };
}

export function validateOwnership(input: {
  ownerUserId: string | null | undefined;
  allowedOwnerIds: Set<string>;
}): { valid: boolean; reason?: string } {
  if (!input.ownerUserId) return { valid: true };
  if (!input.allowedOwnerIds.has(input.ownerUserId)) {
    return { valid: false, reason: "owner_not_org_member" };
  }
  return { valid: true };
}

export function detectHierarchyCycle(
  nodes: Array<{ id: string; parentId: string | null }>,
  nodeId: string,
  nextParentId: string | null,
): boolean {
  if (!nextParentId) return false;
  if (nextParentId === nodeId) return true;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let current = byId.get(nextParentId);
  const seen = new Set<string>([nodeId]);
  let depth = 0;
  while (current && depth < OrgPlatformDefaults.maxHierarchyDepth) {
    if (seen.has(current.id)) return true;
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
    depth += 1;
  }
  return false;
}

export function buildOrgReport(input: {
  departments: number;
  businessUnits: number;
  costCenters: number;
  approvalWorkflows: number;
  ownedDepartments: number;
  allocationTotal: number;
}) {
  return {
    departments: input.departments,
    businessUnits: input.businessUnits,
    costCenters: input.costCenters,
    approvalWorkflows: input.approvalWorkflows,
    ownedDepartments: input.ownedDepartments,
    allocationTotal: Number(input.allocationTotal.toFixed(2)),
    coverage:
      input.departments === 0
        ? 0
        : Number((input.ownedDepartments / input.departments).toFixed(2)),
  };
}
