import assert from "node:assert/strict";
import {
  AdminPolicyDecisions,
  AdminPolicyStatuses,
  AdminPolicyTypes,
} from "@trustchain/config";
import {
  collectApplicablePolicies,
  detectPolicyConflicts,
  evaluatePolicies,
  evaluateQuotaRules,
  evaluateRetentionRules,
  mergeInheritedRules,
  resolveInheritanceChain,
  type PolicyAssignmentLike,
  type PolicyDefinitionLike,
} from "../admin.policy.engine.js";

function policy(
  partial: Partial<PolicyDefinitionLike> & Pick<PolicyDefinitionLike, "id" | "policyType">,
): PolicyDefinitionLike {
  return {
    name: partial.name ?? partial.id,
    status: partial.status ?? AdminPolicyStatuses.active,
    priority: partial.priority ?? 100,
    parentPolicyId: partial.parentPolicyId ?? null,
    rules: partial.rules ?? {},
    id: partial.id,
    policyType: partial.policyType,
  };
}

function assignment(
  partial: Partial<PolicyAssignmentLike> &
    Pick<PolicyAssignmentLike, "id" | "policyId" | "organizationId">,
): PolicyAssignmentLike {
  return {
    inheritToChildren: partial.inheritToChildren ?? true,
    enabled: partial.enabled ?? true,
    id: partial.id,
    policyId: partial.policyId,
    organizationId: partial.organizationId,
  };
}

export function testPolicyAssignment(): void {
  const policies = [
    policy({
      id: "p-global",
      policyType: AdminPolicyTypes.feature,
      rules: { features: { beta: true } },
    }),
    policy({
      id: "p-org",
      policyType: AdminPolicyTypes.feature,
      rules: { features: { beta: false } },
      priority: 200,
    }),
  ];
  const assignments = [
    assignment({ id: "a1", policyId: "p-org", organizationId: "org-child" }),
  ];

  const applicable = collectApplicablePolicies({
    policies,
    assignments,
    organizationId: "org-child",
    ancestorOrganizationIds: ["org-parent"],
  });
  assert.equal(applicable.length, 2);
  assert.ok(applicable.some((p) => p.id === "p-global"));
  assert.ok(applicable.some((p) => p.id === "p-org"));

  const inheritedOnly = collectApplicablePolicies({
    policies: [
      policy({
        id: "p-parent",
        policyType: AdminPolicyTypes.quota,
        rules: { limits: { users: 10 } },
      }),
    ],
    assignments: [
      assignment({
        id: "a2",
        policyId: "p-parent",
        organizationId: "org-parent",
        inheritToChildren: true,
      }),
    ],
    organizationId: "org-child",
    ancestorOrganizationIds: ["org-parent"],
    includeGlobal: false,
  });
  assert.equal(inheritedOnly.length, 1);
  assert.equal(inheritedOnly[0]?.id, "p-parent");
}

export function testPolicyInheritance(): void {
  const parent = policy({
    id: "parent",
    policyType: AdminPolicyTypes.permission,
    rules: { grant: ["admin.view"], deny: [] },
  });
  const child = policy({
    id: "child",
    policyType: AdminPolicyTypes.permission,
    parentPolicyId: "parent",
    rules: { grant: ["admin.manage"], deny: ["admin.audit.view"] },
  });
  const byId = new Map([
    [parent.id, parent],
    [child.id, child],
  ]);
  const chain = resolveInheritanceChain(child, byId);
  assert.deepEqual(
    chain.map((p) => p.id),
    ["parent", "child"],
  );
  const merged = mergeInheritedRules(chain);
  assert.deepEqual(merged.grant, ["admin.manage"]);
  assert.deepEqual(merged.deny, ["admin.audit.view"]);
}

export function testPolicyEvaluation(): void {
  const result = evaluatePolicies({
    policies: [
      policy({
        id: "perm",
        policyType: AdminPolicyTypes.permission,
        rules: { grant: ["admin.view"], deny: ["admin.manage"] },
      }),
    ],
    assignments: [],
    organizationId: null,
    ancestorOrganizationIds: [],
    policyType: AdminPolicyTypes.permission,
    context: { capability: "admin.view" },
  });
  assert.equal(result.decision, AdminPolicyDecisions.allow);

  const denied = evaluatePolicies({
    policies: [
      policy({
        id: "perm2",
        policyType: AdminPolicyTypes.permission,
        rules: { grant: ["admin.view"], deny: ["admin.manage"] },
      }),
    ],
    assignments: [],
    organizationId: null,
    ancestorOrganizationIds: [],
    policyType: AdminPolicyTypes.permission,
    context: { capability: "admin.manage" },
  });
  assert.equal(denied.decision, AdminPolicyDecisions.deny);
}

export function testConflictDetection(): void {
  const conflicts = detectPolicyConflicts([
    {
      ...policy({
        id: "a",
        policyType: AdminPolicyTypes.quota,
        priority: 100,
        rules: { limits: { users: 10 } },
      }),
      effectiveRules: { limits: { users: 10 } },
    },
    {
      ...policy({
        id: "b",
        policyType: AdminPolicyTypes.quota,
        priority: 100,
        rules: { limits: { users: 50 } },
      }),
      effectiveRules: { limits: { users: 50 } },
    },
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.key, "limits");

  const evaluated = evaluatePolicies({
    policies: [
      policy({
        id: "a",
        policyType: AdminPolicyTypes.feature,
        priority: 50,
        rules: { features: { beta: true } },
      }),
      policy({
        id: "b",
        policyType: AdminPolicyTypes.feature,
        priority: 50,
        rules: { features: { beta: false } },
      }),
    ],
    assignments: [],
    organizationId: null,
    ancestorOrganizationIds: [],
    policyType: AdminPolicyTypes.feature,
    context: { featureKey: "beta" },
  });
  assert.equal(evaluated.decision, AdminPolicyDecisions.conflict);
  assert.ok(evaluated.conflicts.length >= 1);
}

export function testRetentionRules(): void {
  const early = evaluateRetentionRules(
    { retainDays: 90, action: "archive" },
    { retentionAgeDays: 30 },
    "ret-1",
  );
  assert.equal(early.decision, AdminPolicyDecisions.deny);

  const ready = evaluateRetentionRules(
    { retainDays: 90, action: "archive" },
    { retentionAgeDays: 120 },
    "ret-1",
  );
  assert.equal(ready.decision, AdminPolicyDecisions.allow);

  const retainForever = evaluateRetentionRules(
    { retainDays: 30, action: "retain" },
    { retentionAgeDays: 100 },
    "ret-2",
  );
  assert.equal(retainForever.decision, AdminPolicyDecisions.deny);
}

export function testQuotaRules(): void {
  const ok = evaluateQuotaRules(
    { limits: { users: 50, documents: 1000 } },
    { resource: "users", usage: 10 },
    "q-1",
  );
  assert.equal(ok.decision, AdminPolicyDecisions.allow);
  assert.equal((ok.details as { remaining: number }).remaining, 40);

  const exceeded = evaluateQuotaRules(
    { limits: { users: 50 } },
    { resource: "users", usage: 50 },
    "q-1",
  );
  assert.equal(exceeded.decision, AdminPolicyDecisions.deny);

  const full = evaluatePolicies({
    policies: [
      policy({
        id: "quota",
        policyType: AdminPolicyTypes.quota,
        rules: { limits: { signatures: 5 } },
      }),
    ],
    assignments: [
      assignment({ id: "aq", policyId: "quota", organizationId: "org-1" }),
    ],
    organizationId: "org-1",
    ancestorOrganizationIds: [],
    policyType: AdminPolicyTypes.quota,
    context: { resource: "signatures", usage: 6 },
    includeGlobal: false,
  });
  assert.equal(full.decision, AdminPolicyDecisions.deny);
}
