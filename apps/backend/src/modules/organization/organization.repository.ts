import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  evaluateApprovalProgress,
  resolveApprovalChain,
  validateApprovalSteps,
  type ApprovalStepInput,
} from "./organization.approvals.js";
import {
  buildOrgReport,
  buildTree,
  detectHierarchyCycle,
  resolveInheritedPolicy,
  validateOwnership,
  type PolicyMap,
} from "./organization.hierarchy.js";

function asPolicy(value: Prisma.JsonValue | null | undefined): PolicyMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PolicyMap;
}

function toPublicDepartment(row: {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  code: string | null;
  parentDepartmentId: string | null;
  businessUnitId: string | null;
  costCenterId: string | null;
  ownerUserId: string | null;
  policyJson: Prisma.JsonValue;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    branchId: row.branchId,
    name: row.name,
    code: row.code,
    parentDepartmentId: row.parentDepartmentId,
    businessUnitId: row.businessUnitId,
    costCenterId: row.costCenterId,
    ownerUserId: row.ownerUserId,
    policy: asPolicy(row.policyJson),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicBusinessUnit(row: {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string | null;
  parentUnitId: string | null;
  ownerUserId: string | null;
  policyJson: Prisma.JsonValue;
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
    parentUnitId: row.parentUnitId,
    ownerUserId: row.ownerUserId,
    policy: asPolicy(row.policyJson),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function memberOwnerIds(organizationId: string): Promise<Set<string>> {
  const members = await prisma.membership.findMany({
    where: { organizationId, status: "active" },
    select: { userId: true },
  });
  return new Set(members.map((m) => m.userId));
}

async function assertOwnerAllowed(organizationId: string, ownerUserId?: string | null) {
  if (!ownerUserId) return;
  const allowed = await memberOwnerIds(organizationId);
  const check = validateOwnership({ ownerUserId, allowedOwnerIds: allowed });
  if (!check.valid) {
    throw new AppError(400, "VALIDATION_ERROR", "Owner must be an active organization member");
  }
}

export async function getOrganizationPlatform(organizationId: string) {
  const [departments, businessUnits, costCenters, workflows, org] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.orgBusinessUnit.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.orgCostCenter.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    }),
    prisma.orgApprovalWorkflow.findMany({
      where: { organizationId },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true, parentOrganizationId: true },
    }),
  ]);

  const report = buildOrgReport({
    departments: departments.length,
    businessUnits: businessUnits.length,
    costCenters: costCenters.length,
    approvalWorkflows: workflows.length,
    ownedDepartments: departments.filter((d) => d.ownerUserId).length,
    allocationTotal: costCenters.reduce((sum, c) => sum + c.allocationPct, 0),
  });

  return {
    organization: org,
    departments: departments.map(toPublicDepartment),
    businessUnits: businessUnits.map(toPublicBusinessUnit),
    costCenters: costCenters.map((c) => ({
      id: c.id,
      organizationId: c.organizationId,
      code: c.code,
      name: c.name,
      businessUnitId: c.businessUnitId,
      ownerUserId: c.ownerUserId,
      allocationPct: c.allocationPct,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
    approvals: workflows.map((w) => ({
      id: w.id,
      name: w.name,
      resourceType: w.resourceType,
      status: w.status,
      steps: w.steps.map((s) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        approverType: s.approverType,
        approverRef: s.approverRef,
        name: s.name,
      })),
      createdAt: w.createdAt.toISOString(),
    })),
    report,
  };
}

export async function createDepartment(input: {
  organizationId: string;
  name: string;
  code?: string | null;
  branchId?: string | null;
  parentDepartmentId?: string | null;
  businessUnitId?: string | null;
  costCenterId?: string | null;
  ownerUserId?: string | null;
  policy?: PolicyMap;
  status?: string;
}) {
  await assertOwnerAllowed(input.organizationId, input.ownerUserId);
  if (input.parentDepartmentId) {
    const parent = await prisma.department.findFirst({
      where: { id: input.parentDepartmentId, organizationId: input.organizationId },
    });
    if (!parent) throw new AppError(400, "VALIDATION_ERROR", "Parent department not found");
  }

  const row = await prisma.department.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      code: input.code ?? null,
      branchId: input.branchId ?? null,
      parentDepartmentId: input.parentDepartmentId ?? null,
      businessUnitId: input.businessUnitId ?? null,
      costCenterId: input.costCenterId ?? null,
      ownerUserId: input.ownerUserId ?? null,
      policyJson: (input.policy ?? {}) as Prisma.InputJsonValue,
      status: input.status ?? "active",
    },
  });
  return { department: toPublicDepartment(row) };
}

export async function getDepartment(id: string) {
  return prisma.department.findUnique({ where: { id } });
}

export async function patchDepartment(
  id: string,
  input: {
    name?: string;
    code?: string | null;
    branchId?: string | null;
    parentDepartmentId?: string | null;
    businessUnitId?: string | null;
    costCenterId?: string | null;
    ownerUserId?: string | null;
    policy?: PolicyMap;
    status?: string;
  },
) {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) return null;
  await assertOwnerAllowed(existing.organizationId, input.ownerUserId);

  if (input.parentDepartmentId !== undefined) {
    const siblings = await prisma.department.findMany({
      where: { organizationId: existing.organizationId },
      select: { id: true, parentDepartmentId: true },
    });
    if (
      detectHierarchyCycle(
        siblings.map((d) => ({ id: d.id, parentId: d.parentDepartmentId })),
        id,
        input.parentDepartmentId,
      )
    ) {
      throw new AppError(400, "VALIDATION_ERROR", "Department hierarchy cycle detected");
    }
  }

  const row = await prisma.department.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.parentDepartmentId !== undefined
        ? { parentDepartmentId: input.parentDepartmentId }
        : {}),
      ...(input.businessUnitId !== undefined ? { businessUnitId: input.businessUnitId } : {}),
      ...(input.costCenterId !== undefined ? { costCenterId: input.costCenterId } : {}),
      ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
      ...(input.policy !== undefined
        ? { policyJson: input.policy as Prisma.InputJsonValue }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    } as Prisma.DepartmentUncheckedUpdateInput,
  });
  return { department: toPublicDepartment(row) };
}

export async function createBusinessUnit(input: {
  organizationId: string;
  key: string;
  name: string;
  description?: string | null;
  parentUnitId?: string | null;
  ownerUserId?: string | null;
  policy?: PolicyMap;
  status?: string;
  costCenter?: { code: string; name: string; allocationPct?: number };
}) {
  await assertOwnerAllowed(input.organizationId, input.ownerUserId);
  if (input.parentUnitId) {
    const parent = await prisma.orgBusinessUnit.findFirst({
      where: { id: input.parentUnitId, organizationId: input.organizationId },
    });
    if (!parent) throw new AppError(400, "VALIDATION_ERROR", "Parent business unit not found");
  }

  const row = await prisma.orgBusinessUnit.create({
    data: {
      organizationId: input.organizationId,
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      parentUnitId: input.parentUnitId ?? null,
      ownerUserId: input.ownerUserId ?? null,
      policyJson: (input.policy ?? {}) as Prisma.InputJsonValue,
      status: input.status ?? "active",
    },
  });

  let costCenter = null;
  if (input.costCenter) {
    costCenter = await prisma.orgCostCenter.create({
      data: {
        organizationId: input.organizationId,
        code: input.costCenter.code,
        name: input.costCenter.name,
        businessUnitId: row.id,
        ownerUserId: input.ownerUserId ?? null,
        allocationPct: input.costCenter.allocationPct ?? 100,
      },
    });
  }

  return {
    businessUnit: toPublicBusinessUnit(row),
    costCenter: costCenter
      ? {
          id: costCenter.id,
          code: costCenter.code,
          name: costCenter.name,
          allocationPct: costCenter.allocationPct,
        }
      : null,
  };
}

export async function getBusinessUnit(id: string) {
  return prisma.orgBusinessUnit.findUnique({ where: { id } });
}

export async function patchBusinessUnit(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    parentUnitId?: string | null;
    ownerUserId?: string | null;
    policy?: PolicyMap;
    status?: string;
  },
) {
  const existing = await prisma.orgBusinessUnit.findUnique({ where: { id } });
  if (!existing) return null;
  await assertOwnerAllowed(existing.organizationId, input.ownerUserId);

  if (input.parentUnitId !== undefined) {
    const units = await prisma.orgBusinessUnit.findMany({
      where: { organizationId: existing.organizationId },
      select: { id: true, parentUnitId: true },
    });
    if (
      detectHierarchyCycle(
        units.map((u) => ({ id: u.id, parentId: u.parentUnitId })),
        id,
        input.parentUnitId,
      )
    ) {
      throw new AppError(400, "VALIDATION_ERROR", "Business unit hierarchy cycle detected");
    }
  }

  const row = await prisma.orgBusinessUnit.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.parentUnitId !== undefined ? { parentUnitId: input.parentUnitId } : {}),
      ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
      ...(input.policy !== undefined
        ? { policyJson: input.policy as Prisma.InputJsonValue }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    } as Prisma.OrgBusinessUnitUncheckedUpdateInput,
  });
  return { businessUnit: toPublicBusinessUnit(row) };
}

export async function getHierarchy(organizationId: string) {
  const [org, businessUnits, departments, costCenters] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true, parentOrganizationId: true },
    }),
    prisma.orgBusinessUnit.findMany({ where: { organizationId } }),
    prisma.department.findMany({ where: { organizationId } }),
    prisma.orgCostCenter.findMany({ where: { organizationId } }),
  ]);
  if (!org) throw new AppError(404, "NOT_FOUND", "Organization not found");

  const flat = [
    ...businessUnits.map((u) => ({
      id: u.id,
      key: u.key,
      name: u.name,
      parentId: u.parentUnitId,
      type: "business_unit" as const,
      ownerUserId: u.ownerUserId,
      policy: asPolicy(u.policyJson),
    })),
    ...departments.map((d) => ({
      id: d.id,
      key: d.code ?? d.id.slice(0, 8),
      name: d.name,
      parentId: d.parentDepartmentId ?? d.businessUnitId,
      type: "department" as const,
      ownerUserId: d.ownerUserId,
      policy: asPolicy(d.policyJson),
    })),
    ...costCenters.map((c) => ({
      id: c.id,
      key: c.code,
      name: c.name,
      parentId: c.businessUnitId,
      type: "cost_center" as const,
      ownerUserId: c.ownerUserId,
      policy: {},
    })),
  ];

  const tree = buildTree(flat, null);

  const inheritance = departments.map((d) => {
    const nodes = departments.map((x) => ({
      id: x.id,
      parentId: x.parentDepartmentId,
      policy: asPolicy(x.policyJson),
    }));
    const resolved = resolveInheritedPolicy(nodes, d.id);
    return {
      departmentId: d.id,
      name: d.name,
      inheritedPolicy: resolved.policy,
      chain: resolved.chain,
    };
  });

  return {
    organization: org,
    tree,
    inheritance,
    counts: {
      businessUnits: businessUnits.length,
      departments: departments.length,
      costCenters: costCenters.length,
    },
  };
}

export async function createApprovalWorkflow(input: {
  organizationId: string;
  name: string;
  resourceType: string;
  status?: string;
  steps: ApprovalStepInput[];
  createdById?: string | null;
  actorUserId: string;
  resourceOwnerUserId?: string | null;
}) {
  const steps = validateApprovalSteps(input.steps);
  const workflow = await prisma.orgApprovalWorkflow.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      resourceType: input.resourceType,
      status: input.status ?? "active",
      createdById: input.createdById ?? null,
      steps: {
        create: steps.map((s) => ({
          stepOrder: s.stepOrder,
          approverType: s.approverType,
          approverRef: s.approverRef,
          name: s.name ?? null,
        })),
      },
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  const chain = resolveApprovalChain(steps, {
    resourceType: input.resourceType,
    resourceOwnerUserId: input.resourceOwnerUserId,
    actorUserId: input.actorUserId,
  });
  const progress = evaluateApprovalProgress({
    steps: chain,
    completedOrders: [],
  });

  return {
    workflow: {
      id: workflow.id,
      organizationId: workflow.organizationId,
      name: workflow.name,
      resourceType: workflow.resourceType,
      status: workflow.status,
      steps: workflow.steps.map((s) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        approverType: s.approverType,
        approverRef: s.approverRef,
        name: s.name,
      })),
      createdAt: workflow.createdAt.toISOString(),
    },
    chain,
    progress,
  };
}
