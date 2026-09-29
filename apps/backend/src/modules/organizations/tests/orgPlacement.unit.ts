import assert from "node:assert/strict";
import { AppError } from "../../../lib/errors.js";
import { resolvePlacement } from "../orgPlacement.js";

const org = "11111111-1111-1111-1111-111111111111";
const branchA = "22222222-2222-2222-2222-222222222222";
const branchB = "33333333-3333-3333-3333-333333333333";
const deptA = "44444444-4444-4444-4444-444444444444";

export function testPlacementAssignsBranchAndDepartment(): void {
  const placed = resolvePlacement({
    organizationId: org,
    branchId: branchA,
    departmentId: deptA,
    branch: { id: branchA, organizationId: org },
    department: { id: deptA, organizationId: org, branchId: branchA },
  });
  assert.equal(placed.branchId, branchA);
  assert.equal(placed.departmentId, deptA);
}

export function testPlacementInheritsBranchFromDepartment(): void {
  const placed = resolvePlacement({
    organizationId: org,
    departmentId: deptA,
    branch: null,
    department: { id: deptA, organizationId: org, branchId: branchA },
  });
  assert.equal(placed.branchId, branchA);
  assert.equal(placed.departmentId, deptA);
}

export function testPlacementRejectsDepartmentOnOtherBranch(): void {
  assert.throws(
    () =>
      resolvePlacement({
        organizationId: org,
        branchId: branchB,
        departmentId: deptA,
        branch: { id: branchB, organizationId: org },
        department: { id: deptA, organizationId: org, branchId: branchA },
      }),
    (error) => error instanceof AppError && error.code === "BRANCH_DEPARTMENT_MISMATCH",
  );
}

export function testPlacementRejectsUnknownBranch(): void {
  assert.throws(
    () =>
      resolvePlacement({
        organizationId: org,
        branchId: branchA,
        branch: null,
        department: null,
      }),
    (error) => error instanceof AppError && error.code === "BRANCH_NOT_FOUND",
  );
}
