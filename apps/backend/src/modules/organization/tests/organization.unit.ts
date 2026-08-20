import assert from "node:assert/strict";
import {
  evaluateApprovalProgress,
  resolveApprovalChain,
  validateApprovalSteps,
} from "../organization.approvals.js";
import {
  buildOrgReport,
  buildTree,
  detectHierarchyCycle,
  mergePolicies,
  resolveInheritedPolicy,
  validateOwnership,
} from "../organization.hierarchy.js";
import { AppError } from "../../../lib/errors.js";

export function testHierarchyConstruction(): void {
  const tree = buildTree([
    { id: "bu1", key: "corp", name: "Corporate", parentId: null, type: "business_unit" },
    { id: "bu2", key: "eng", name: "Engineering", parentId: "bu1", type: "business_unit" },
    { id: "d1", key: "plat", name: "Platform", parentId: "bu2", type: "department" },
    { id: "cc1", key: "CC-100", name: "Eng CC", parentId: "bu2", type: "cost_center" },
  ]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0]!.key, "corp");
  assert.equal(tree[0]!.children?.[0]?.key, "eng");
  assert.equal(tree[0]!.children?.[0]?.children?.length, 2);

  assert.equal(
    detectHierarchyCycle(
      [
        { id: "a", parentId: null },
        { id: "b", parentId: "a" },
      ],
      "a",
      "b",
    ),
    true,
  );
  assert.equal(
    detectHierarchyCycle(
      [
        { id: "a", parentId: null },
        { id: "b", parentId: "a" },
      ],
      "b",
      null,
    ),
    false,
  );
}

export function testInheritanceResolution(): void {
  const merged = mergePolicies(
    { retention: { days: 365 }, mfa: true },
    { retention: { days: 90 }, classification: "internal" },
  );
  assert.deepEqual(merged, {
    retention: { days: 90 },
    mfa: true,
    classification: "internal",
  });

  const resolved = resolveInheritedPolicy(
    [
      { id: "root", parentId: null, policy: { mfa: true, level: "org" } },
      { id: "child", parentId: "root", policy: { level: "dept" } },
    ],
    "child",
  );
  assert.equal(resolved.policy.mfa, true);
  assert.equal(resolved.policy.level, "dept");
  assert.deepEqual(resolved.chain, ["root", "child"]);
}

export function testApprovalWorkflows(): void {
  const steps = validateApprovalSteps([
    { stepOrder: 2, approverType: "role", approverRef: "org_admin" },
    { stepOrder: 1, approverType: "owner", approverRef: "owner" },
  ]);
  assert.equal(steps[0]!.stepOrder, 1);

  const chain = resolveApprovalChain(steps, {
    resourceType: "department",
    resourceOwnerUserId: "user-1",
    actorUserId: "user-1",
  });
  assert.equal(chain[0]!.autoApprove, true);
  assert.equal(chain[0]!.resolvedUserId, "user-1");

  const progress = evaluateApprovalProgress({
    steps: chain,
    completedOrders: [],
  });
  assert.equal(progress.completed, false);
  assert.equal(progress.nextStepOrder, 2);

  assert.throws(
    () => validateApprovalSteps([]),
    (err: unknown) => err instanceof AppError,
  );
}

export function testOwnershipValidation(): void {
  const ok = validateOwnership({
    ownerUserId: "u1",
    allowedOwnerIds: new Set(["u1", "u2"]),
  });
  assert.equal(ok.valid, true);

  const bad = validateOwnership({
    ownerUserId: "u9",
    allowedOwnerIds: new Set(["u1"]),
  });
  assert.equal(bad.valid, false);
  assert.equal(bad.reason, "owner_not_org_member");

  assert.equal(validateOwnership({ ownerUserId: null, allowedOwnerIds: new Set() }).valid, true);
}

export function testOrganizationalReporting(): void {
  const report = buildOrgReport({
    departments: 10,
    businessUnits: 3,
    costCenters: 4,
    approvalWorkflows: 2,
    ownedDepartments: 5,
    allocationTotal: 250,
  });
  assert.equal(report.departments, 10);
  assert.equal(report.coverage, 0.5);
  assert.equal(report.allocationTotal, 250);
}
