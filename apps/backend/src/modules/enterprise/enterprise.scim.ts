import { randomBytes } from "node:crypto";
import { EnterpriseDefaults, EnterpriseScimStatuses } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { hashToken } from "../../lib/crypto.js";

export type ScimUserResource = {
  schemas?: string[];
  id?: string;
  userName: string;
  active?: boolean;
  name?: { givenName?: string; familyName?: string };
  emails?: Array<{ value: string; primary?: boolean }>;
  externalId?: string;
  department?: string;
  title?: string;
};

export type ScimProvisionResult = {
  operation: "create" | "update" | "deactivate";
  externalId: string;
  userName: string;
  email: string;
  active: boolean;
  displayName: string;
  attributes: Record<string, string>;
};

export function generateScimBearerToken(): { token: string; hash: string; hint: string } {
  const token = randomBytes(EnterpriseDefaults.scimTokenBytes).toString("base64url");
  return {
    token,
    hash: hashToken(token),
    hint: token.slice(-4),
  };
}

export function validateScimConfig(input: {
  baseUrl: string;
  status?: string;
  userMapping?: Record<string, string> | null;
}): {
  baseUrl: string;
  status: string;
  userMapping: Record<string, string>;
} {
  const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new AppError(400, "VALIDATION_ERROR", "SCIM base URL must be http(s)");
  }
  return {
    baseUrl,
    status: input.status ?? EnterpriseScimStatuses.draft,
    userMapping: input.userMapping ?? {
      userName: "email",
      givenName: "firstName",
      familyName: "lastName",
    },
  };
}

export function verifyScimBearerToken(rawToken: string, expectedHash: string): boolean {
  if (!rawToken || !expectedHash) return false;
  return hashToken(rawToken) === expectedHash;
}

/**
 * Pure SCIM user provisioning evaluation (foundation — no IdP round-trip).
 */
export function provisionScimUser(
  resource: ScimUserResource,
  existingExternalIds: Set<string> = new Set(),
): ScimProvisionResult {
  const email =
    resource.emails?.find((e) => e.primary)?.value?.trim() ||
    resource.emails?.[0]?.value?.trim() ||
    resource.userName?.trim();
  if (!email || !email.includes("@")) {
    throw new AppError(400, "SCIM_INVALID_USER", "SCIM user requires a valid email");
  }
  const userName = (resource.userName || email).trim();
  const externalId = (resource.externalId || resource.id || userName).trim();
  const active = resource.active !== false;
  const displayName = [resource.name?.givenName, resource.name?.familyName]
    .filter(Boolean)
    .join(" ")
    .trim() || userName;

  let operation: ScimProvisionResult["operation"] = "create";
  if (existingExternalIds.has(externalId)) {
    operation = active ? "update" : "deactivate";
  } else if (!active) {
    operation = "deactivate";
  }

  return {
    operation,
    externalId,
    userName,
    email: email.toLowerCase(),
    active,
    displayName,
    attributes: {
      department: resource.department ?? "",
      title: resource.title ?? "",
      givenName: resource.name?.givenName ?? "",
      familyName: resource.name?.familyName ?? "",
    },
  };
}

export function applyScimPatch(
  current: { active: boolean; userName: string; email: string },
  operations: Array<{ op: string; path?: string; value?: unknown }>,
): { active: boolean; userName: string; email: string; changed: boolean } {
  let next = { ...current };
  let changed = false;
  for (const op of operations) {
    const action = op.op.toLowerCase();
    if (action === "replace" && (op.path === "active" || op.path === undefined)) {
      if (typeof op.value === "boolean") {
        next.active = op.value;
        changed = true;
      } else if (op.value && typeof op.value === "object" && "active" in (op.value as object)) {
        next.active = Boolean((op.value as { active: boolean }).active);
        changed = true;
      }
    }
    if (action === "replace" && op.path === "userName" && typeof op.value === "string") {
      next.userName = op.value;
      changed = true;
    }
    if (action === "replace" && op.path === "emails" && Array.isArray(op.value)) {
      const first = op.value[0] as { value?: string } | undefined;
      if (first?.value) {
        next.email = first.value.toLowerCase();
        changed = true;
      }
    }
  }
  return { ...next, changed };
}
