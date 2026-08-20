import {
  EnterpriseAccessReviewDecisions,
  EnterpriseAccessReviewStatuses,
  EnterpriseDefaults,
  EnterpriseDelegateStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { buildSpMetadataXml, validateSamlConfig } from "./enterprise.saml.js";
import {
  generateScimBearerToken,
  provisionScimUser,
  validateScimConfig,
  type ScimUserResource,
} from "./enterprise.scim.js";

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export type EnterpriseRoleNode = {
  id: string;
  key: string;
  name: string;
  parentRoleId: string | null;
  permissions: string[];
  status: string;
};

/** Resolve permissions including ancestor roles (child inherits parent). */
export function resolveInheritedPermissions(
  roles: EnterpriseRoleNode[],
  roleId: string,
  maxDepth = EnterpriseDefaults.maxRoleDepth,
): string[] {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const perms = new Set<string>();
  let current = byId.get(roleId);
  let depth = 0;
  const seen = new Set<string>();
  while (current && depth < maxDepth) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    for (const p of current.permissions) perms.add(p);
    current = current.parentRoleId ? byId.get(current.parentRoleId) : undefined;
    depth += 1;
  }
  return [...perms].sort();
}

export function collectRoleAncestors(
  roles: EnterpriseRoleNode[],
  roleId: string,
  maxDepth = EnterpriseDefaults.maxRoleDepth,
): string[] {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const keys: string[] = [];
  let current = byId.get(roleId);
  let depth = 0;
  const seen = new Set<string>();
  while (current && depth < maxDepth) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    keys.push(current.key);
    current = current.parentRoleId ? byId.get(current.parentRoleId) : undefined;
    depth += 1;
  }
  return keys;
}

export type AbacRule = {
  attribute: string;
  operator: "eq" | "neq" | "in" | "contains";
  value: string | string[];
};

export type AbacPolicyEval = {
  id: string;
  effect: "allow" | "deny";
  rules: AbacRule[];
  resourceType?: string | null;
  priority: number;
  status: string;
};

function matchRule(rule: AbacRule, attrs: Record<string, string | string[]>): boolean {
  const raw = attrs[rule.attribute];
  if (raw === undefined) return false;
  const values = Array.isArray(raw) ? raw : [raw];
  if (rule.operator === "eq") return values.some((v) => v === rule.value);
  if (rule.operator === "neq") return values.every((v) => v !== rule.value);
  if (rule.operator === "in") {
    const allowed = Array.isArray(rule.value) ? rule.value : [rule.value];
    return values.some((v) => allowed.includes(v));
  }
  if (rule.operator === "contains") {
    const needle = Array.isArray(rule.value) ? rule.value[0] : rule.value;
    if (!needle) return false;
    return values.some((v) => v.includes(needle));
  }
  return false;
}

/**
 * Deny-overrides ABAC: first matching deny wins; else first matching allow; else deny.
 */
export function evaluateAbac(input: {
  policies: AbacPolicyEval[];
  attributes: Record<string, string | string[]>;
  resourceType?: string;
}): { decision: "allow" | "deny"; matchedPolicyId: string | null; reason: string } {
  const active = input.policies
    .filter((p) => p.status === "active")
    .filter((p) => !p.resourceType || !input.resourceType || p.resourceType === input.resourceType)
    .sort((a, b) => a.priority - b.priority);

  let allowId: string | null = null;
  for (const policy of active) {
    const matched = policy.rules.every((r) => matchRule(r, input.attributes));
    if (!matched) continue;
    if (policy.effect === "deny") {
      return { decision: "deny", matchedPolicyId: policy.id, reason: "deny_override" };
    }
    if (!allowId) allowId = policy.id;
  }
  if (allowId) {
    return { decision: "allow", matchedPolicyId: allowId, reason: "allow_match" };
  }
  return { decision: "deny", matchedPolicyId: null, reason: "default_deny" };
}

export function summarizeAccessReview(items: Array<{ decision: string }>): {
  total: number;
  pending: number;
  approved: number;
  revoked: number;
  complete: boolean;
} {
  const total = items.length;
  const pending = items.filter((i) => i.decision === EnterpriseAccessReviewDecisions.pending).length;
  const approved = items.filter((i) => i.decision === EnterpriseAccessReviewDecisions.approve).length;
  const revoked = items.filter((i) => i.decision === EnterpriseAccessReviewDecisions.revoke).length;
  return { total, pending, approved, revoked, complete: total > 0 && pending === 0 };
}

function toPublicSaml(row: {
  id: string;
  organizationId: string;
  status: string;
  entityId: string;
  acsUrl: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificatePem: string;
  attributeMappingJson: Prisma.JsonValue;
  metadataXml: string | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    status: row.status,
    entityId: row.entityId,
    acsUrl: row.acsUrl,
    idpEntityId: row.idpEntityId,
    idpSsoUrl: row.idpSsoUrl,
    idpCertificatePem: row.idpCertificatePem.slice(0, 64) + "…",
    attributeMapping: row.attributeMappingJson,
    metadataXml: row.metadataXml,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicScim(row: {
  id: string;
  organizationId: string;
  status: string;
  baseUrl: string;
  tokenHint: string;
  userMappingJson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    status: row.status,
    baseUrl: row.baseUrl,
    tokenHint: row.tokenHint,
    userMapping: row.userMappingJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicRole(row: {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string | null;
  parentRoleId: string | null;
  permissionsJson: Prisma.JsonValue;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    name: row.name,
    description: row.description,
    parentRoleId: row.parentRoleId,
    permissions: asStringArray(row.permissionsJson),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getEnterpriseDashboard(organizationId: string) {
  const [saml, scim, roles, abac, delegates, reviews] = await Promise.all([
    prisma.enterpriseSamlConfig.findUnique({ where: { organizationId } }),
    prisma.enterpriseScimConfig.findUnique({ where: { organizationId } }),
    prisma.enterpriseRole.findMany({
      where: { organizationId },
      orderBy: { key: "asc" },
      take: 100,
    }),
    prisma.enterpriseAbacPolicy.findMany({
      where: { organizationId, status: "active" },
      orderBy: { priority: "asc" },
      take: 50,
    }),
    prisma.enterpriseDelegateAdmin.findMany({
      where: { organizationId, status: EnterpriseDelegateStatuses.active },
      take: 50,
    }),
    prisma.enterpriseAccessReview.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { items: true },
    }),
  ]);

  const roleNodes: EnterpriseRoleNode[] = roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    parentRoleId: r.parentRoleId,
    permissions: asStringArray(r.permissionsJson),
    status: r.status,
  }));

  return {
    organizationId,
    saml: saml ? toPublicSaml(saml) : null,
    scim: scim ? toPublicScim(scim) : null,
    roles: roles.map((r) => ({
      ...toPublicRole(r),
      inheritedPermissions: resolveInheritedPermissions(roleNodes, r.id),
      ancestors: collectRoleAncestors(roleNodes, r.id),
    })),
    abacPolicies: abac.map((p) => ({
      id: p.id,
      name: p.name,
      effect: p.effect,
      rules: p.rulesJson,
      resourceType: p.resourceType,
      priority: p.priority,
      status: p.status,
    })),
    delegates: delegates.map((d) => ({
      id: d.id,
      delegateUserId: d.delegateUserId,
      scope: asStringArray(d.scopeJson),
      status: d.status,
      expiresAt: d.expiresAt?.toISOString() ?? null,
    })),
    accessReviews: reviews.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      dueAt: r.dueAt?.toISOString() ?? null,
      summary: summarizeAccessReview(r.items),
      items: r.items.map((i) => ({
        id: i.id,
        subjectUserId: i.subjectUserId,
        roleKey: i.roleKey,
        decision: i.decision,
        notes: i.notes,
        decidedAt: i.decidedAt?.toISOString() ?? null,
      })),
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  };
}

export async function upsertSamlConfig(input: {
  organizationId: string;
  entityId: string;
  acsUrl: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificatePem: string;
  attributeMapping?: Parameters<typeof validateSamlConfig>[0]["attributeMapping"];
  status?: string;
  updatedById?: string | null;
  organizationName?: string;
  startAccessReview?: boolean;
}) {
  const validated = validateSamlConfig(input);
  const metadataXml = buildSpMetadataXml({
    entityId: validated.entityId,
    acsUrl: validated.acsUrl,
    organizationName: input.organizationName,
  });

  const row = await prisma.enterpriseSamlConfig.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      status: validated.status,
      entityId: validated.entityId,
      acsUrl: validated.acsUrl,
      idpEntityId: validated.idpEntityId,
      idpSsoUrl: validated.idpSsoUrl,
      idpCertificatePem: validated.idpCertificatePem,
      attributeMappingJson: validated.attributeMapping,
      metadataXml,
      updatedById: input.updatedById ?? null,
    },
    update: {
      status: validated.status,
      entityId: validated.entityId,
      acsUrl: validated.acsUrl,
      idpEntityId: validated.idpEntityId,
      idpSsoUrl: validated.idpSsoUrl,
      idpCertificatePem: validated.idpCertificatePem,
      attributeMappingJson: validated.attributeMapping,
      metadataXml,
      updatedById: input.updatedById ?? null,
    },
  });

  let accessReview = null;
  if (input.startAccessReview) {
    accessReview = await createAccessReview({
      organizationId: input.organizationId,
      title: "SSO enablement access review",
      createdById: input.updatedById,
    });
  }

  return { saml: toPublicSaml(row), accessReview };
}

export async function upsertScimConfig(input: {
  organizationId: string;
  baseUrl: string;
  status?: string;
  userMapping?: Record<string, string> | null;
  rotateToken?: boolean;
  updatedById?: string | null;
  provisionUser?: ScimUserResource;
}) {
  const validated = validateScimConfig(input);
  const existing = await prisma.enterpriseScimConfig.findUnique({
    where: { organizationId: input.organizationId },
  });

  let token: string | null = null;
  let hash = existing?.bearerTokenHash;
  let hint = existing?.tokenHint;
  if (!existing || input.rotateToken !== false) {
    const generated = generateScimBearerToken();
    token = generated.token;
    hash = generated.hash;
    hint = generated.hint;
  }
  if (!hash || !hint) {
    const generated = generateScimBearerToken();
    token = generated.token;
    hash = generated.hash;
    hint = generated.hint;
  }

  const row = await prisma.enterpriseScimConfig.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      status: validated.status,
      baseUrl: validated.baseUrl,
      bearerTokenHash: hash,
      tokenHint: hint,
      userMappingJson: validated.userMapping,
      updatedById: input.updatedById ?? null,
    },
    update: {
      status: validated.status,
      baseUrl: validated.baseUrl,
      bearerTokenHash: hash,
      tokenHint: hint,
      userMappingJson: validated.userMapping,
      updatedById: input.updatedById ?? null,
    },
  });

  let provision = null;
  if (input.provisionUser) {
    // Foundation: evaluate provisioning against known external ids stored in userMapping cache key space
    const known = new Set<string>();
    provision = provisionScimUser(input.provisionUser, known);
  }

  return {
    scim: toPublicScim(row),
    bearerToken: token,
    provision,
  };
}

export async function listRoles(query: {
  organizationId: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.EnterpriseRoleWhereInput = {
    organizationId: query.organizationId,
    ...(query.status ? { status: query.status } : {}),
  };
  const [rows, total, allForInheritance] = await Promise.all([
    prisma.enterpriseRole.findMany({
      where,
      orderBy: { key: "asc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.enterpriseRole.count({ where }),
    prisma.enterpriseRole.findMany({
      where: { organizationId: query.organizationId },
      select: { id: true, key: true, name: true, parentRoleId: true, permissionsJson: true, status: true },
    }),
  ]);
  const nodes: EnterpriseRoleNode[] = allForInheritance.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    parentRoleId: r.parentRoleId,
    permissions: asStringArray(r.permissionsJson),
    status: r.status,
  }));
  return {
    roles: rows.map((r) => ({
      ...toPublicRole(r),
      inheritedPermissions: resolveInheritedPermissions(nodes, r.id),
      ancestors: collectRoleAncestors(nodes, r.id),
    })),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createRole(input: {
  organizationId: string;
  key: string;
  name: string;
  description?: string | null;
  parentRoleId?: string | null;
  permissions?: string[];
  status?: string;
  createdById?: string | null;
  abac?: {
    name: string;
    effect: string;
    rules: AbacRule[];
    resourceType?: string | null;
    priority?: number;
  };
  delegateUserId?: string;
  delegateScope?: string[];
}) {
  if (input.parentRoleId) {
    const parent = await prisma.enterpriseRole.findFirst({
      where: { id: input.parentRoleId, organizationId: input.organizationId },
    });
    if (!parent) throw new AppError(400, "VALIDATION_ERROR", "Parent role not found in organization");
  }

  const row = await prisma.enterpriseRole.create({
    data: {
      organizationId: input.organizationId,
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      parentRoleId: input.parentRoleId ?? null,
      permissionsJson: input.permissions ?? [],
      status: input.status ?? "active",
      createdById: input.createdById ?? null,
    },
  });

  let abac = null;
  if (input.abac) {
    abac = await prisma.enterpriseAbacPolicy.create({
      data: {
        organizationId: input.organizationId,
        name: input.abac.name,
        effect: input.abac.effect,
        rulesJson: input.abac.rules as unknown as Prisma.InputJsonValue,
        resourceType: input.abac.resourceType ?? null,
        priority: input.abac.priority ?? 100,
        createdById: input.createdById ?? null,
      },
    });
  }

  let delegate = null;
  if (input.delegateUserId) {
    delegate = await prisma.enterpriseDelegateAdmin.upsert({
      where: {
        organizationId_delegateUserId: {
          organizationId: input.organizationId,
          delegateUserId: input.delegateUserId,
        },
      },
      create: {
        organizationId: input.organizationId,
        delegateUserId: input.delegateUserId,
        scopeJson: input.delegateScope ?? [input.key],
        status: EnterpriseDelegateStatuses.active,
        grantedById: input.createdById ?? null,
      },
      update: {
        scopeJson: input.delegateScope ?? [input.key],
        status: EnterpriseDelegateStatuses.active,
        grantedById: input.createdById ?? null,
      },
    });
  }

  const all = await prisma.enterpriseRole.findMany({
    where: { organizationId: input.organizationId },
    select: { id: true, key: true, name: true, parentRoleId: true, permissionsJson: true, status: true },
  });
  const nodes: EnterpriseRoleNode[] = all.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    parentRoleId: r.parentRoleId,
    permissions: asStringArray(r.permissionsJson),
    status: r.status,
  }));

  return {
    role: {
      ...toPublicRole(row),
      inheritedPermissions: resolveInheritedPermissions(nodes, row.id),
      ancestors: collectRoleAncestors(nodes, row.id),
    },
    abac: abac
      ? {
          id: abac.id,
          name: abac.name,
          effect: abac.effect,
          priority: abac.priority,
        }
      : null,
    delegate: delegate
      ? {
          id: delegate.id,
          delegateUserId: delegate.delegateUserId,
          scope: asStringArray(delegate.scopeJson),
        }
      : null,
  };
}

export async function getRole(id: string) {
  return prisma.enterpriseRole.findUnique({ where: { id } });
}

export async function patchRole(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    parentRoleId?: string | null;
    permissions?: string[];
    status?: string;
    accessReviewItemId?: string;
    accessReviewDecision?: string;
    accessReviewNotes?: string | null;
  },
) {
  const existing = await prisma.enterpriseRole.findUnique({ where: { id } });
  if (!existing) return null;

  if (input.parentRoleId) {
    if (input.parentRoleId === id) {
      throw new AppError(400, "VALIDATION_ERROR", "Role cannot be its own parent");
    }
    const parent = await prisma.enterpriseRole.findFirst({
      where: { id: input.parentRoleId, organizationId: existing.organizationId },
    });
    if (!parent) throw new AppError(400, "VALIDATION_ERROR", "Parent role not found");
  }

  const row = await prisma.enterpriseRole.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.parentRoleId !== undefined ? { parentRoleId: input.parentRoleId } : {}),
      ...(input.permissions !== undefined ? { permissionsJson: input.permissions } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });

  let reviewItem = null;
  if (input.accessReviewItemId && input.accessReviewDecision) {
    reviewItem = await completeAccessReviewItem({
      itemId: input.accessReviewItemId,
      decision: input.accessReviewDecision,
      notes: input.accessReviewNotes,
    });
  }

  const all = await prisma.enterpriseRole.findMany({
    where: { organizationId: existing.organizationId },
    select: { id: true, key: true, name: true, parentRoleId: true, permissionsJson: true, status: true },
  });
  const nodes: EnterpriseRoleNode[] = all.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    parentRoleId: r.parentRoleId,
    permissions: asStringArray(r.permissionsJson),
    status: r.status,
  }));

  return {
    role: {
      ...toPublicRole(row),
      inheritedPermissions: resolveInheritedPermissions(nodes, row.id),
      ancestors: collectRoleAncestors(nodes, row.id),
    },
    reviewItem,
  };
}

export async function createAccessReview(input: {
  organizationId: string;
  title: string;
  createdById?: string | null;
  subjectUserIds?: string[];
  roleKey?: string;
}) {
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: input.organizationId,
      status: "active",
      ...(input.subjectUserIds?.length ? { userId: { in: input.subjectUserIds } } : {}),
    },
    take: 100,
    select: { userId: true },
  });

  const roleKey = input.roleKey ?? "member";
  const review = await prisma.enterpriseAccessReview.create({
    data: {
      organizationId: input.organizationId,
      title: input.title,
      status: EnterpriseAccessReviewStatuses.open,
      createdById: input.createdById ?? null,
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: {
        create: memberships.map((m) => ({
          subjectUserId: m.userId,
          roleKey,
          decision: EnterpriseAccessReviewDecisions.pending,
        })),
      },
    },
    include: { items: true },
  });

  return {
    id: review.id,
    title: review.title,
    status: review.status,
    summary: summarizeAccessReview(review.items),
    itemCount: review.items.length,
    createdAt: review.createdAt.toISOString(),
  };
}

export async function completeAccessReviewItem(input: {
  itemId: string;
  decision: string;
  notes?: string | null;
}) {
  const item = await prisma.enterpriseAccessReviewItem.update({
    where: { id: input.itemId },
    data: {
      decision: input.decision,
      notes: input.notes ?? null,
      decidedAt: new Date(),
    },
    include: { review: { include: { items: true } } },
  });

  const summary = summarizeAccessReview(item.review.items);
  if (summary.complete && item.review.status === EnterpriseAccessReviewStatuses.open) {
    await prisma.enterpriseAccessReview.update({
      where: { id: item.reviewId },
      data: {
        status: EnterpriseAccessReviewStatuses.completed,
        completedAt: new Date(),
      },
    });
  }

  return {
    id: item.id,
    decision: item.decision,
    roleKey: item.roleKey,
    subjectUserId: item.subjectUserId,
    reviewId: item.reviewId,
    reviewComplete: summary.complete,
  };
}
