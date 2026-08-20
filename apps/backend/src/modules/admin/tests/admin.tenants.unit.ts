import assert from "node:assert/strict";
import { TenantLifecycleStatuses } from "@trustchain/config";
import {
  assertTenantQuotas,
  defaultTenantQuotaLimits,
  emptyTenantQuotaUsage,
  enforceTenantQuota,
  parseTenantQuotaLimits,
  quotaUtilization,
  resolveLifecycleTransition,
  slugifyTenantName,
} from "../admin.tenants.workflow.js";

export function testTenantSuspension(): void {
  const ok = resolveLifecycleTransition("suspend", TenantLifecycleStatuses.active);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.toStatus, TenantLifecycleStatuses.suspended);

  const fromDisabled = resolveLifecycleTransition("suspend", "disabled");
  assert.equal(fromDisabled.ok, true);
  if (fromDisabled.ok) assert.equal(fromDisabled.toStatus, TenantLifecycleStatuses.suspended);

  const blocked = resolveLifecycleTransition("suspend", TenantLifecycleStatuses.archived);
  assert.equal(blocked.ok, false);
}

export function testTenantRestoration(): void {
  for (const from of [
    TenantLifecycleStatuses.suspended,
    TenantLifecycleStatuses.archived,
    TenantLifecycleStatuses.transferred,
    "disabled",
  ]) {
    const result = resolveLifecycleTransition("restore", from);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.toStatus, TenantLifecycleStatuses.active);
  }

  const blocked = resolveLifecycleTransition("restore", TenantLifecycleStatuses.active);
  assert.equal(blocked.ok, false);
}

export function testTenantArchival(): void {
  const fromActive = resolveLifecycleTransition("archive", TenantLifecycleStatuses.active);
  assert.equal(fromActive.ok, true);
  if (fromActive.ok) assert.equal(fromActive.toStatus, TenantLifecycleStatuses.archived);

  const fromSuspended = resolveLifecycleTransition("archive", TenantLifecycleStatuses.suspended);
  assert.equal(fromSuspended.ok, true);

  const blocked = resolveLifecycleTransition("archive", TenantLifecycleStatuses.archived);
  assert.equal(blocked.ok, false);
}

export function testTenantTransfer(): void {
  const ok = resolveLifecycleTransition("transfer", TenantLifecycleStatuses.active);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.toStatus, TenantLifecycleStatuses.transferred);

  const fromSuspended = resolveLifecycleTransition("transfer", TenantLifecycleStatuses.suspended);
  assert.equal(fromSuspended.ok, true);

  const blocked = resolveLifecycleTransition("transfer", TenantLifecycleStatuses.archived);
  assert.equal(blocked.ok, false);

  assert.equal(slugifyTenantName("Acme Corp!"), "acme-corp");
}

export function testQuotaEnforcement(): void {
  const limits = defaultTenantQuotaLimits({ users: 2, documents: 5, storageBytes: 1000 });
  const usage = emptyTenantQuotaUsage();
  usage.users = 2;
  usage.documents = 4;

  const usersCheck = enforceTenantQuota(limits, usage, "users", 1);
  assert.equal(usersCheck.ok, false);
  if (!usersCheck.ok) assert.match(usersCheck.reason, /users/);

  const docsCheck = enforceTenantQuota(limits, usage, "documents", 1);
  assert.equal(docsCheck.ok, true);

  const unlimited = enforceTenantQuota(
    defaultTenantQuotaLimits({ organizations: 0 }),
    emptyTenantQuotaUsage(),
    "organizations",
    100,
  );
  assert.equal(unlimited.ok, true);

  const batch = assertTenantQuotas(limits, usage, [
    { resource: "documents", delta: 1 },
    { resource: "users", delta: 1 },
  ]);
  assert.equal(batch[0]!.ok, true);
  assert.equal(batch[1]!.ok, false);

  const parsed = parseTenantQuotaLimits({ users: 10, bogus: 1 });
  assert.equal(parsed.users, 10);
  assert.ok(parsed.documents > 0);

  const util = quotaUtilization(limits, usage);
  const usersRow = util.find((r) => r.resource === "users");
  assert.equal(usersRow?.percent, 100);
}
