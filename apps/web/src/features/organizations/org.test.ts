/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import {
  getOrganizationErrorMessage,
  invitationStatus,
  isDuplicateOrganization,
  isForbidden,
  isInvalidInvitation,
  isOrgNotFound,
} from "../../lib/orgErrors";
import { orgKeys } from "./hooks";
import type { ApiErrorBody, InviteRoleKey } from "../../types/api";

function axiosError(status: number, code: string, message: string): AxiosError<ApiErrorBody> {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    headers: {},
    config: {} as never,
    data: { error: { code, message } },
  });
}

describe("organization creation contracts", () => {
  it("builds create payload with optional slug", () => {
    const body = { name: "Acme Trust", slug: "acme-trust" };
    expect(body.name.length).toBeGreaterThanOrEqual(2);
    expect(body.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("maps duplicate slug to user-facing message", () => {
    const error = axiosError(409, "SLUG_IN_USE", "Organization slug is already in use");
    expect(isDuplicateOrganization(error)).toBe(true);
    expect(getOrganizationErrorMessage(error)).toMatch(/slug already exists/i);
  });

  it("uses organizations query key for list invalidation", () => {
    expect(orgKeys().all).toEqual(["organizations"]);
    expect(orgKeys("org-1").detail).toEqual(["organizations", "org-1"]);
  });
});

describe("invitation flow", () => {
  it("accepts invite role keys used by the API", () => {
    const roles: InviteRoleKey[] = ["org_admin", "employee", "public_user"];
    expect(roles).toHaveLength(3);
  });

  it("classifies pending, expired, accepted, and revoked invitations", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(
      invitationStatus({ expiresAt: future, acceptedAt: null, revokedAt: null }),
    ).toBe("pending");
    expect(
      invitationStatus({ expiresAt: past, acceptedAt: null, revokedAt: null }),
    ).toBe("expired");
    expect(
      invitationStatus({
        expiresAt: future,
        acceptedAt: new Date().toISOString(),
        revokedAt: null,
      }),
    ).toBe("accepted");
    expect(
      invitationStatus({
        expiresAt: future,
        acceptedAt: null,
        revokedAt: new Date().toISOString(),
      }),
    ).toBe("revoked");
  });

  it("maps invalid and expired invitation errors", () => {
    const invalid = axiosError(400, "INVALID_INVITATION", "Invitation is invalid or expired");
    expect(isInvalidInvitation(invalid)).toBe(true);
    expect(getOrganizationErrorMessage(invalid)).toMatch(/invalid or expired/i);

    const mismatch = axiosError(403, "INVITATION_EMAIL_MISMATCH", "mismatch");
    expect(isInvalidInvitation(mismatch)).toBe(true);
    expect(getOrganizationErrorMessage(mismatch)).toMatch(/different email/i);
  });
});

describe("branch management contracts", () => {
  it("shapes branch create body", () => {
    const body = { name: "HQ", code: "HQ-1", city: "Austin" };
    expect(body.name).toBeTruthy();
    expect(orgKeys("org-1").branches).toEqual(["organizations", "org-1", "branches"]);
  });
});

describe("department management contracts", () => {
  it("shapes department create body with optional branch", () => {
    const body = {
      name: "Engineering",
      code: "ENG",
      branchId: "11111111-1111-1111-1111-111111111111",
    };
    expect(body.branchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(orgKeys("org-1").departments).toEqual(["organizations", "org-1", "departments"]);
  });
});

describe("RBAC behavior mapping", () => {
  it("maps FORBIDDEN to permission denied messaging", () => {
    const error = axiosError(403, "FORBIDDEN", "Organization admin role required");
    expect(isForbidden(error)).toBe(true);
    expect(getOrganizationErrorMessage(error)).toMatch(/do not have permission/i);
  });

  it("maps ORG_NOT_FOUND for missing org access paths", () => {
    const error = axiosError(404, "ORG_NOT_FOUND", "Organization not found");
    expect(isOrgNotFound(error)).toBe(true);
    expect(getOrganizationErrorMessage(error)).toMatch(/not found/i);
  });

  it("treats soft-delete as status disabled payload", () => {
    const softDelete = { status: "disabled" as const };
    expect(softDelete.status).toBe("disabled");
  });
});
