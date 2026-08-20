/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { getHomeRoute, isOrgAdminOnly, shouldRedirectSuperAdminFromWorkspace } from "./homeRoute";

describe("homeRoute", () => {
  it("sends super admins to the platform console", () => {
    expect(
      getHomeRoute([{ roleKey: "super_admin", roleName: "Super Admin", organizationId: null }]),
    ).toBe("/admin");
  });

  it("sends org admins to their organization home", () => {
    const roles = [
      { roleKey: "org_admin", roleName: "Org Admin", organizationId: "org-1" },
    ];
    expect(getHomeRoute(roles, { memberships: [{ organizationId: "org-1" }] })).toBe(
      "/organizations/org-1",
    );
  });

  it("sends holders to my certificates", () => {
    expect(
      getHomeRoute([
        { roleKey: "public_user", roleName: "Public User", organizationId: "org-1" },
      ]),
    ).toBe("/my-certificates");
  });

  it("treats super admin as not org-admin-only", () => {
    expect(
      isOrgAdminOnly([
        { roleKey: "super_admin", roleName: "Super Admin", organizationId: null },
        { roleKey: "org_admin", roleName: "Org Admin", organizationId: "org-1" },
      ]),
    ).toBe(false);
  });

  it("redirects super admins away from the enterprise workspace shell", () => {
    expect(shouldRedirectSuperAdminFromWorkspace("/dashboard")).toBe(true);
    expect(shouldRedirectSuperAdminFromWorkspace("/documents")).toBe(true);
    expect(shouldRedirectSuperAdminFromWorkspace("/organizations/org-1/members")).toBe(true);
    expect(shouldRedirectSuperAdminFromWorkspace("/admin/tenants")).toBe(false);
    expect(shouldRedirectSuperAdminFromWorkspace("/platform")).toBe(false);
    expect(shouldRedirectSuperAdminFromWorkspace("/settings")).toBe(false);
  });
});
