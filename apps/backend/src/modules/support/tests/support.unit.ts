import assert from "node:assert/strict";
import { parseBody } from "../../../lib/validate.js";
import {
  canAccessBug,
  canAccessInquiry,
  canCreateBug,
  canCreateInquiry,
  canRespondToBug,
  canUseInquiries,
  decodeImagePayload,
  isOpenBugStatus,
  nextInquiryStatusAfterMessage,
  orgAdminOrganizationIds,
} from "../support.access.js";
import { createBugBodySchema, createInquiryBodySchema } from "../support.schemas.js";

const sa = [{ roleKey: "super_admin", roleName: "Super Admin", organizationId: null }];
const orgAdmin = [{ roleKey: "org_admin", roleName: "Org Admin", organizationId: "org-1" }];
const employee = [{ roleKey: "employee", roleName: "Employee", organizationId: "org-1" }];

export function testSupportAccessRules(): void {
  assert.deepEqual(orgAdminOrganizationIds(orgAdmin), ["org-1"]);
  assert.equal(canCreateInquiry(orgAdmin), true);
  assert.equal(canCreateInquiry(sa), false);
  assert.equal(canCreateInquiry(employee), false);
  assert.equal(canUseInquiries(sa), true);
  assert.equal(canUseInquiries(employee), false);
  assert.equal(canCreateBug(sa), false);
  assert.equal(canCreateBug(orgAdmin), true);
  assert.equal(canCreateBug(employee), true);
  assert.equal(canRespondToBug(sa), true);
  assert.equal(canRespondToBug(orgAdmin), false);

  assert.equal(
    canAccessInquiry(sa, { createdById: "u1", organizationId: "org-1" }, "sa"),
    true,
  );
  assert.equal(
    canAccessInquiry(orgAdmin, { createdById: "other", organizationId: "org-1" }, "u1"),
    true,
  );
  assert.equal(
    canAccessInquiry(orgAdmin, { createdById: "other", organizationId: "org-2" }, "u1"),
    false,
  );
  assert.equal(canAccessBug(sa, "u1", "sa"), true);
  assert.equal(canAccessBug(employee, "u1", "u1"), true);
  assert.equal(canAccessBug(employee, "u1", "u2"), false);
}

export function testSupportStatusRules(): void {
  assert.equal(nextInquiryStatusAfterMessage(true, "open"), "answered");
  assert.equal(nextInquiryStatusAfterMessage(false, "answered"), "open");
  assert.equal(nextInquiryStatusAfterMessage(true, "closed"), "answered");
  assert.equal(isOpenBugStatus("open"), true);
  assert.equal(isOpenBugStatus("fixed"), false);
}

export function testSupportValidation(): void {
  const inquiry = parseBody(createInquiryBodySchema, {
    subject: "Need tenant help",
    body: "How do we add a second branch?",
    organizationId: "11111111-1111-1111-1111-111111111111",
  });
  assert.equal(inquiry.subject, "Need tenant help");

  assert.throws(() =>
    parseBody(createInquiryBodySchema, {
      subject: "x",
      body: "too short subject",
    }),
  );

  const bug = parseBody(createBugBodySchema, {
    title: "Verify button stuck",
    description: "The verify action never finishes on the hash page.",
  });
  assert.equal(bug.title, "Verify button stuck");

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
  const decoded = decodeImagePayload(png, "image/png");
  assert.equal(decoded.length, 4);
}
