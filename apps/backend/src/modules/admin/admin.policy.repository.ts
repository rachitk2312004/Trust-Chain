import { randomBytes } from "node:crypto";
import { AdminIdPrefixes } from "@trustchain/config";
import { prisma, Prisma } from "@trustchain/database";
import type { PolicyRules } from "./admin.policy.engine.js";

function generatePolicyPublicCode() {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${AdminIdPrefixes.policy}-${suffix}`;
}

export type PolicyDefinitionRow = {
  id: string;
  publicCode: string;
  name: string;
  description: string | null;
  policyType: string;
  status: string;
  priority: number;
  parentPolicyId: string | null;
  rulesJson: Prisma.JsonValue;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PolicyAssignmentRow = {
  id: string;
  policyId: string;
  organizationId: string;
  inheritToChildren: boolean;
  enabled: boolean;
  createdById: string | null;
  createdAt: Date;
};

export type PolicyEvaluationEventRow = {
  id: string;
  policyId: string | null;
  organizationId: string | null;
  actorUserId: string | null;
  policyType: string | null;
  decision: string;
  contextJson: Prisma.JsonValue | null;
  resultJson: Prisma.JsonValue | null;
  createdAt: Date;
};

function asRules(value: Prisma.JsonValue): PolicyRules {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as PolicyRules;
  }
  return {};
}

export function toPublicPolicy(
  row: PolicyDefinitionRow,
  assignments: PolicyAssignmentRow[] = [],
) {
  return {
    id: row.id,
    publicCode: row.publicCode,
    name: row.name,
    description: row.description,
    policyType: row.policyType,
    status: row.status,
    priority: row.priority,
    parentPolicyId: row.parentPolicyId,
    rules: asRules(row.rulesJson),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assignments: assignments.map(toPublicAssignment),
  };
}

export function toPublicAssignment(row: PolicyAssignmentRow) {
  return {
    id: row.id,
    policyId: row.policyId,
    organizationId: row.organizationId,
    inheritToChildren: row.inheritToChildren,
    enabled: row.enabled,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPublicEvaluation(row: PolicyEvaluationEventRow) {
  return {
    id: row.id,
    policyId: row.policyId,
    organizationId: row.organizationId,
    actorUserId: row.actorUserId,
    policyType: row.policyType,
    decision: row.decision,
    context: row.contextJson ?? null,
    result: row.resultJson ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPolicyDefinitions(input: {
  policyType?: string;
  status?: string;
  organizationId?: string;
  search?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.PolicyDefinitionWhereInput = {};
  if (input.policyType) where.policyType = input.policyType;
  if (input.status) where.status = input.status;
  if (input.search) {
    where.OR = [
      { name: { contains: input.search, mode: "insensitive" } },
      { publicCode: { contains: input.search, mode: "insensitive" } },
      { description: { contains: input.search, mode: "insensitive" } },
    ];
  }
  if (input.organizationId) {
    where.assignments = { some: { organizationId: input.organizationId } };
  }

  const [rows, total] = await Promise.all([
    prisma.policyDefinition.findMany({
      where,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: input.limit,
      skip: input.offset,
      include: { assignments: true },
    }),
    prisma.policyDefinition.count({ where }),
  ]);

  return {
    policies: rows.map((row) => toPublicPolicy(row, row.assignments)),
    total,
    limit: input.limit,
    offset: input.offset,
  };
}

export async function getPolicyDefinition(policyId: string) {
  return prisma.policyDefinition.findUnique({
    where: { id: policyId },
    include: { assignments: true },
  });
}

export async function createPolicyDefinition(input: {
  name: string;
  description?: string | null;
  policyType: string;
  status: string;
  priority: number;
  parentPolicyId?: string | null;
  rules: PolicyRules;
  createdById: string;
}) {
  return prisma.policyDefinition.create({
    data: {
      publicCode: generatePolicyPublicCode(),
      name: input.name,
      description: input.description ?? null,
      policyType: input.policyType,
      status: input.status,
      priority: input.priority,
      parentPolicyId: input.parentPolicyId ?? null,
      rulesJson: input.rules as Prisma.InputJsonValue,
      createdById: input.createdById,
    },
    include: { assignments: true },
  });
}

export async function updatePolicyDefinition(
  policyId: string,
  input: {
    name?: string;
    description?: string | null;
    status?: string;
    priority?: number;
    parentPolicyId?: string | null;
    rules?: PolicyRules;
  },
) {
  return prisma.policyDefinition.update({
    where: { id: policyId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.parentPolicyId !== undefined
        ? { parentPolicyId: input.parentPolicyId }
        : {}),
      ...(input.rules !== undefined
        ? { rulesJson: input.rules as Prisma.InputJsonValue }
        : {}),
    },
    include: { assignments: true },
  });
}

export async function deletePolicyDefinition(policyId: string) {
  return prisma.policyDefinition.delete({ where: { id: policyId } });
}

export async function replacePolicyAssignments(
  policyId: string,
  assignments: Array<{
    organizationId: string;
    inheritToChildren: boolean;
    enabled: boolean;
  }>,
  createdById: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.policyAssignment.deleteMany({ where: { policyId } });
    if (assignments.length === 0) return [];
    await tx.policyAssignment.createMany({
      data: assignments.map((a) => ({
        policyId,
        organizationId: a.organizationId,
        inheritToChildren: a.inheritToChildren,
        enabled: a.enabled,
        createdById,
      })),
    });
    return tx.policyAssignment.findMany({ where: { policyId } });
  });
}

export async function listAllActivePoliciesAndAssignments(policyType?: string | null) {
  const where: Prisma.PolicyDefinitionWhereInput = {};
  if (policyType) where.policyType = policyType;

  const [policies, assignments] = await Promise.all([
    prisma.policyDefinition.findMany({ where }),
    prisma.policyAssignment.findMany(),
  ]);
  return { policies, assignments };
}

export async function getOrganizationAncestorIds(organizationId: string) {
  const ancestors: string[] = [];
  let currentId: string | null = organizationId;
  const seen = new Set<string>();
  while (currentId) {
    if (seen.has(currentId)) break;
    seen.add(currentId);
    const org: { parentOrganizationId: string | null } | null =
      await prisma.organization.findUnique({
        where: { id: currentId },
        select: { parentOrganizationId: true },
      });
    if (!org?.parentOrganizationId) break;
    ancestors.push(org.parentOrganizationId);
    currentId = org.parentOrganizationId;
  }
  return ancestors;
}

export async function createPolicyEvaluationEvent(input: {
  policyId?: string | null;
  organizationId?: string | null;
  actorUserId?: string | null;
  policyType?: string | null;
  decision: string;
  context?: unknown;
  result?: unknown;
}) {
  return prisma.policyEvaluationEvent.create({
    data: {
      policyId: input.policyId ?? null,
      organizationId: input.organizationId ?? null,
      actorUserId: input.actorUserId ?? null,
      policyType: input.policyType ?? null,
      decision: input.decision,
      contextJson:
        input.context === undefined
          ? undefined
          : (input.context as Prisma.InputJsonValue),
      resultJson:
        input.result === undefined
          ? undefined
          : (input.result as Prisma.InputJsonValue),
    },
  });
}

export async function listRecentEvaluations(policyId: string, limit = 20) {
  return prisma.policyEvaluationEvent.findMany({
    where: { policyId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
