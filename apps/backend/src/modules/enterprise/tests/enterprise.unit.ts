import assert from "node:assert/strict";
import {
  buildSpMetadataXml,
  mapSamlAttributes,
  normalizeAttributeMapping,
  validateSamlConfig,
} from "../enterprise.saml.js";
import {
  applyScimPatch,
  generateScimBearerToken,
  provisionScimUser,
  validateScimConfig,
  verifyScimBearerToken,
} from "../enterprise.scim.js";
import {
  evaluateAbac,
  resolveInheritedPermissions,
  summarizeAccessReview,
} from "../enterprise.repository.js";
import { AppError } from "../../../lib/errors.js";

const PEM = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWy
-----END CERTIFICATE-----`;

export function testSamlConfiguration(): void {
  const cfg = validateSamlConfig({
    entityId: "https://sp.trustchain.local/saml",
    acsUrl: "https://api.trustchain.local/api/v1/auth/saml/acs",
    idpEntityId: "https://idp.example.com",
    idpSsoUrl: "https://idp.example.com/sso",
    idpCertificatePem: PEM,
    attributeMapping: { email: "mail" },
  });
  assert.equal(cfg.attributeMapping.email, "mail");
  assert.equal(normalizeAttributeMapping(null).email, "email");

  const xml = buildSpMetadataXml({
    entityId: cfg.entityId,
    acsUrl: cfg.acsUrl,
    organizationName: "Acme <Corp>",
  });
  assert.ok(xml.includes("EntityDescriptor"));
  assert.ok(xml.includes("Acme &lt;Corp&gt;"));

  const mapped = mapSamlAttributes(
    { mail: "a@example.com", groups: ["admins", "finance"] },
    cfg.attributeMapping,
  );
  assert.equal(mapped.email, "a@example.com");
  assert.deepEqual(mapped.groups, ["admins", "finance"]);

  assert.throws(
    () =>
      validateSamlConfig({
        entityId: "x",
        acsUrl: "not-a-url",
        idpEntityId: "idp",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificatePem: "nope",
      }),
    (err: unknown) => err instanceof AppError,
  );
}

export function testScimProvisioning(): void {
  const cfg = validateScimConfig({ baseUrl: "https://api.example.com/scim/v2/" });
  assert.equal(cfg.baseUrl, "https://api.example.com/scim/v2");

  const created = provisionScimUser({
    userName: "jane",
    emails: [{ value: "jane@example.com", primary: true }],
    name: { givenName: "Jane", familyName: "Doe" },
    externalId: "ext-1",
  });
  assert.equal(created.operation, "create");
  assert.equal(created.email, "jane@example.com");

  const updated = provisionScimUser(
    {
      userName: "jane",
      emails: [{ value: "jane@example.com", primary: true }],
      externalId: "ext-1",
      active: true,
    },
    new Set(["ext-1"]),
  );
  assert.equal(updated.operation, "update");

  const deactivated = provisionScimUser(
    {
      userName: "jane",
      emails: [{ value: "jane@example.com" }],
      externalId: "ext-1",
      active: false,
    },
    new Set(["ext-1"]),
  );
  assert.equal(deactivated.operation, "deactivate");

  const token = generateScimBearerToken();
  assert.equal(verifyScimBearerToken(token.token, token.hash), true);
  assert.equal(verifyScimBearerToken("wrong", token.hash), false);

  const patched = applyScimPatch(
    { active: true, userName: "jane", email: "jane@example.com" },
    [{ op: "replace", path: "active", value: false }],
  );
  assert.equal(patched.active, false);
  assert.equal(patched.changed, true);
}

export function testRoleInheritance(): void {
  const roles = [
    {
      id: "r1",
      key: "viewer",
      name: "Viewer",
      parentRoleId: null,
      permissions: ["docs:read"],
      status: "active",
    },
    {
      id: "r2",
      key: "editor",
      name: "Editor",
      parentRoleId: "r1",
      permissions: ["docs:write"],
      status: "active",
    },
    {
      id: "r3",
      key: "admin",
      name: "Admin",
      parentRoleId: "r2",
      permissions: ["docs:admin"],
      status: "active",
    },
  ];
  const perms = resolveInheritedPermissions(roles, "r3");
  assert.deepEqual(perms, ["docs:admin", "docs:read", "docs:write"]);
}

export function testAbacEvaluation(): void {
  const policies = [
    {
      id: "p-deny",
      effect: "deny" as const,
      rules: [{ attribute: "department", operator: "eq" as const, value: "contractor" }],
      priority: 1,
      status: "active",
    },
    {
      id: "p-allow",
      effect: "allow" as const,
      rules: [{ attribute: "department", operator: "eq" as const, value: "finance" }],
      priority: 10,
      status: "active",
    },
  ];

  assert.equal(
    evaluateAbac({
      policies,
      attributes: { department: "finance" },
    }).decision,
    "allow",
  );
  assert.equal(
    evaluateAbac({
      policies,
      attributes: { department: "contractor" },
    }).decision,
    "deny",
  );
  assert.equal(
    evaluateAbac({
      policies,
      attributes: { department: "hr" },
    }).reason,
    "default_deny",
  );
}

export function testAccessReviews(): void {
  const open = summarizeAccessReview([
    { decision: "pending" },
    { decision: "approve" },
    { decision: "pending" },
  ]);
  assert.equal(open.total, 3);
  assert.equal(open.pending, 2);
  assert.equal(open.complete, false);

  const done = summarizeAccessReview([{ decision: "approve" }, { decision: "revoke" }]);
  assert.equal(done.complete, true);
  assert.equal(done.approved, 1);
  assert.equal(done.revoked, 1);
}
