/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { can, isOrgAdmin, rolesForDisplay, showHolderFeatures } from "./permissions";

describe("permissions", () => {
  const admin = [
    { roleKey: "org_admin", roleName: "Org Admin", organizationId: "org-1" },
  ];
  const employee = [
    { roleKey: "employee", roleName: "Employee", organizationId: "org-1" },
  ];

  it("allows org admins to manage invitations and QR", () => {
    expect(isOrgAdmin(admin, "org-1")).toBe(true);
    expect(can(admin, "org.invite", "org-1")).toBe(true);
    expect(can(admin, "qr.manage", "org-1")).toBe(true);
    expect(can(admin, "certificates.manage", "org-1")).toBe(true);
  });

  it("hides admin actions from employees", () => {
    expect(can(employee, "org.invite", "org-1")).toBe(false);
    expect(can(employee, "org.branding", "org-1")).toBe(false);
    expect(can(employee, "documents.upload", "org-1")).toBe(true);
    expect(can(employee, "verification.run", "org-1")).toBe(true);
    expect(can(employee, "certificates.view", "org-1")).toBe(true);
    expect(can(employee, "certificates.issue", "org-1")).toBe(true);
    expect(can(employee, "certificates.manage", "org-1")).toBe(false);
    expect(can(employee, "signatures.view", "org-1")).toBe(true);
    expect(can(employee, "signatures.create", "org-1")).toBe(true);
    expect(can(employee, "signatures.manage", "org-1")).toBe(false);
    expect(can(employee, "admin.view", "org-1")).toBe(false);
    expect(can(employee, "admin.manage", "org-1")).toBe(false);
  });

  it("allows super admins platform admin capabilities", () => {
    const superAdmin = [
      { roleKey: "super_admin", roleName: "Super Admin", organizationId: null },
    ];
    expect(can(superAdmin, "admin.view")).toBe(true);
    expect(can(superAdmin, "admin.manage")).toBe(true);
    expect(can(superAdmin, "org.create")).toBe(true);
  });

  it("restricts org creation to super admins", () => {
    const admin = [
      { roleKey: "org_admin", roleName: "Org Admin", organizationId: "org-1" },
    ];
    expect(can(admin, "org.create", "org-1")).toBe(false);
  });

  it("allows any signed-in user to view own certificates", () => {
    const holder = [
      { roleKey: "public_user", roleName: "Public User", organizationId: "org-1" },
    ];
    expect(can(holder, "certificates.own.view")).toBe(true);
    expect(can(holder, "certificates.own.share")).toBe(true);
    expect(can(holder, "certificates.view", "org-1")).toBe(false);
  });

  it("hides public_user in display when staff roles exist", () => {
    const mixed = [
      { roleKey: "public_user", roleName: "Public User", organizationId: null },
      { roleKey: "super_admin", roleName: "Super Admin", organizationId: null },
    ];
    expect(rolesForDisplay(mixed).map((r) => r.roleKey)).toEqual(["super_admin"]);
  });

  it("hides holder navigation for org and platform admins", () => {
    expect(
      showHolderFeatures([
        { roleKey: "org_admin", roleName: "Org Admin", organizationId: "org-1" },
      ], "org-1"),
    ).toBe(false);
    expect(
      showHolderFeatures([
        { roleKey: "super_admin", roleName: "Super Admin", organizationId: null },
      ]),
    ).toBe(false);
    expect(
      showHolderFeatures([
        { roleKey: "public_user", roleName: "Public User", organizationId: "org-1" },
      ], "org-1"),
    ).toBe(true);
  });
});
