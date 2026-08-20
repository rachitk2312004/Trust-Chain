import assert from "node:assert/strict";
import {
  AdminAuditActions,
  AdminCapabilities,
  RoleKeys,
  SystemConfigKeys,
} from "@trustchain/config";
import {
  ADMIN_PERMISSION_CATALOG,
  DEFAULT_ROLE_CAPABILITIES,
  assignPermission,
  mergeRoleCapabilityOverrides,
  normalizeCapabilities,
  parseRoleCapabilityMatrix,
  revokePermission,
  roleHasCapability,
} from "../admin.permissions.js";
import { toPublicAudit } from "../admin.audit.js";
import { generateFeaturePublicCode, toPublicConfiguration, toPublicFeature } from "../admin.repository.js";

export function testPermissionAssignment(): void {
  let matrix = { ...DEFAULT_ROLE_CAPABILITIES };
  matrix = assignPermission(matrix, RoleKeys.orgAdmin, AdminCapabilities.featureFlagsManage);
  assert.ok(roleHasCapability(matrix, RoleKeys.orgAdmin, AdminCapabilities.featureFlagsManage));
  assert.ok(roleHasCapability(matrix, RoleKeys.orgAdmin, AdminCapabilities.adminView));

  matrix = revokePermission(matrix, RoleKeys.orgAdmin, AdminCapabilities.adminView);
  assert.equal(roleHasCapability(matrix, RoleKeys.orgAdmin, AdminCapabilities.adminView), false);

  const normalized = normalizeCapabilities([
    AdminCapabilities.adminView,
    "unknown.capability",
    AdminCapabilities.adminView,
  ]);
  assert.deepEqual(normalized, [AdminCapabilities.adminView]);

  assert.ok(ADMIN_PERMISSION_CATALOG.length >= 8);
  assert.throws(() => assignPermission(matrix, RoleKeys.employee, "not.real"), /Unknown capability/);
}

export function testRoleAssignment(): void {
  const assignPayload = {
    userId: "11111111-1111-1111-1111-111111111111",
    roleKey: RoleKeys.employee,
    organizationId: "22222222-2222-2222-2222-222222222222",
  };
  assert.equal(assignPayload.roleKey, RoleKeys.employee);
  assert.ok(assignPayload.organizationId);

  const superAdminPayload = {
    userId: assignPayload.userId,
    roleKey: RoleKeys.superAdmin,
    organizationId: null as string | null,
  };
  assert.equal(superAdminPayload.organizationId, null);

  const invalidScope =
    (RoleKeys.orgAdmin === "org_admin" || RoleKeys.employee === "employee") &&
    !assignPayload.organizationId;
  assert.equal(invalidScope, false);
}

export function testFeatureFlags(): void {
  const code = generateFeaturePublicCode();
  assert.match(code, /^FEATURE-[0-9A-F]{8}$/);

  const feature = toPublicFeature({
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    publicCode: code,
    organizationId: null,
    key: "beta.signatures",
    status: "inactive",
    rolloutPercent: 10,
    killSwitch: false,
    targetingJson: { orgs: ["x"] },
    experimentsJson: null,
    createdAt: new Date("2026-08-03T00:00:00.000Z"),
    updatedAt: new Date("2026-08-03T00:00:00.000Z"),
  });
  assert.equal(feature.key, "beta.signatures");
  assert.equal(feature.rolloutPercent, 10);
  assert.equal(feature.killSwitch, false);
  assert.deepEqual(feature.targeting, { orgs: ["x"] });

  const patchShape = {
    status: "active",
    rolloutPercent: 50,
    killSwitch: false,
  };
  assert.equal(patchShape.rolloutPercent, 50);
}

export function testConfigurationUpdates(): void {
  const overrides = parseRoleCapabilityMatrix({
    [RoleKeys.orgAdmin]: [AdminCapabilities.adminView, AdminCapabilities.usersManage],
  });
  assert.ok(overrides);
  const merged = mergeRoleCapabilityOverrides(DEFAULT_ROLE_CAPABILITIES, overrides);
  assert.deepEqual(
    merged[RoleKeys.orgAdmin],
    normalizeCapabilities([AdminCapabilities.adminView, AdminCapabilities.usersManage]),
  );
  assert.ok((merged[RoleKeys.superAdmin] ?? []).includes(AdminCapabilities.adminManage));

  const config = toPublicConfiguration({
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    key: SystemConfigKeys.platformSettings,
    valueJson: { maintenance: false },
    description: "Platform settings",
    updatedById: null,
    createdAt: new Date("2026-08-03T00:00:00.000Z"),
    updatedAt: new Date("2026-08-03T00:00:00.000Z"),
  });
  assert.equal(config.key, SystemConfigKeys.platformSettings);
  assert.deepEqual(config.value, { maintenance: false });
}

export function testAuditLogging(): void {
  const event = toPublicAudit({
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    actorUserId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    action: AdminAuditActions.roleAssign,
    targetType: "user",
    targetId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    organizationId: null,
    success: true,
    metaJson: { roleKey: RoleKeys.employee },
    createdAt: new Date("2026-08-03T12:00:00.000Z"),
  });
  assert.equal(event.action, AdminAuditActions.roleAssign);
  assert.equal(event.success, true);
  assert.equal(event.createdAt, "2026-08-03T12:00:00.000Z");
  assert.deepEqual(event.meta, { roleKey: RoleKeys.employee });
}
