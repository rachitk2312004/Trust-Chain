/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { canSelfJoinOrganization, getWorkspacePersona, isCertificateHolderOnly } from "./workspacePersona";

describe("workspacePersona", () => {
  it("identifies org admin persona and blocks self-join", () => {
    const roles = [{ roleKey: "org_admin", roleName: "Org Admin", organizationId: "org-1" }];
    expect(getWorkspacePersona(roles, "org-1").kind).toBe("org_admin");
    expect(getWorkspacePersona(roles, "org-1").title).toBe("Organization admin");
    expect(canSelfJoinOrganization(roles)).toBe(false);
  });

  it("identifies employee persona", () => {
    const roles = [{ roleKey: "employee", roleName: "Employee", organizationId: "org-1" }];
    expect(getWorkspacePersona(roles, "org-1").kind).toBe("employee");
    expect(canSelfJoinOrganization(roles)).toBe(true);
  });

  it("identifies certificate holder persona", () => {
    const roles = [{ roleKey: "public_user", roleName: "Holder", organizationId: "org-1" }];
    expect(getWorkspacePersona(roles).kind).toBe("certificate_holder");
    expect(canSelfJoinOrganization(roles)).toBe(true);
  });

  it("allows super admin to use platform console only for join restriction", () => {
    const roles = [{ roleKey: "super_admin", roleName: "Super Admin", organizationId: null }];
    expect(canSelfJoinOrganization(roles)).toBe(false);
  });

  it("detects certificate holder without org membership", () => {
    const roles = [{ roleKey: "public_user", roleName: "Holder", organizationId: null }];
    expect(isCertificateHolderOnly(roles)).toBe(true);
    expect(
      isCertificateHolderOnly([
        { roleKey: "employee", roleName: "Employee", organizationId: "org-1" },
      ]),
    ).toBe(false);
  });
});
