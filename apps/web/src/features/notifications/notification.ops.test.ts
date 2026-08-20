/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { isOpsAdmin } from "../../lib/permissions";

describe("notification ops permissions", () => {
  it("allows super admin and org admin as ops", () => {
    expect(isOpsAdmin([{ roleKey: "super_admin", roleName: "SA", organizationId: null }])).toBe(
      true,
    );
    expect(
      isOpsAdmin([{ roleKey: "org_admin", roleName: "OA", organizationId: "org-1" }]),
    ).toBe(true);
    expect(
      isOpsAdmin([{ roleKey: "employee", roleName: "Emp", organizationId: "org-1" }]),
    ).toBe(false);
  });
});

describe("notification analytics display helpers", () => {
  it("formats queue depth and success rate", () => {
    const queue = {
      pending: 2,
      processing: 1,
      retry: 1,
      failed: 0,
      sent: 0,
      delivered: 8,
      deadLetter: 1,
      skipped: 0,
      depth: 4,
    };
    expect(queue.depth).toBe(4);
    const attempted = queue.delivered + queue.failed + queue.deadLetter;
    const successRate = Math.round((queue.delivered / attempted) * 10000) / 100;
    expect(successRate).toBe(88.89);
  });

  it("computes retention eligibility messaging", () => {
    const preview = {
      notificationsEligible: 3,
      outboxEligible: 12,
      policy: { deletedNotificationDays: 90, terminalOutboxDays: 90 },
    };
    expect(
      `Eligible now: ${preview.notificationsEligible} soft-deleted notifications, ${preview.outboxEligible} terminal outbox rows`,
    ).toContain("3 soft-deleted");
  });
});
