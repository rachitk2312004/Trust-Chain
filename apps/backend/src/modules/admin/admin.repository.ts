import { randomBytes } from "node:crypto";
import { OpsIdPrefixes, OpsEntityStates } from "@trustchain/config";
import { prisma, Prisma } from "@trustchain/database";

export function generateFeaturePublicCode(): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${OpsIdPrefixes.feature}-${suffix}`;
}

export function toPublicFeature(row: {
  id: string;
  publicCode: string;
  organizationId: string | null;
  key: string;
  status: string;
  rolloutPercent: number;
  killSwitch: boolean;
  targetingJson: Prisma.JsonValue | null;
  experimentsJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    publicCode: row.publicCode,
    organizationId: row.organizationId,
    key: row.key,
    status: row.status,
    rolloutPercent: row.rolloutPercent,
    killSwitch: row.killSwitch,
    targeting: row.targetingJson,
    experiments: row.experimentsJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicConfiguration(row: {
  id: string;
  key: string;
  valueJson: Prisma.JsonValue;
  description: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    key: row.key,
    value: row.valueJson,
    description: row.description,
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listUsers(input: {
  search?: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(input.status ? { status: input.status } : {}),
    ...(input.search
      ? {
          OR: [
            { email: { contains: input.search, mode: "insensitive" } },
            { firstName: { contains: input.search, mode: "insensitive" } },
            { lastName: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
      include: {
        roleBindings: { include: { role: true } },
        memberships: {
          select: {
            id: true,
            organizationId: true,
            status: true,
            title: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, limit: input.limit, offset: input.offset };
}

export async function findUserInspection(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      roleBindings: { include: { role: true, organization: { select: { id: true, name: true, slug: true } } } },
      memberships: {
        include: {
          organization: { select: { id: true, name: true, slug: true, status: true } },
          branch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function listOrganizations(input: {
  search?: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.OrganizationWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
      include: {
        _count: {
          select: { memberships: true, roleBindings: true, documents: true },
        },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return { items, total, limit: input.limit, offset: input.offset };
}

export async function findOrganizationInspection(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      memberships: {
        take: 100,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
        },
      },
      roleBindings: {
        take: 100,
        include: {
          role: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
      _count: {
        select: {
          memberships: true,
          roleBindings: true,
          documents: true,
          certificates: true,
          signatures: true,
        },
      },
    },
  });
}

export async function listRoles() {
  return prisma.role.findMany({
    orderBy: { key: "asc" },
    include: { _count: { select: { roleBindings: true } } },
  });
}

export async function findRoleByKey(roleKey: string) {
  return prisma.role.findUnique({ where: { key: roleKey } });
}

export async function createRoleBinding(input: {
  userId: string;
  roleId: string;
  organizationId?: string | null;
}) {
  const organizationId = input.organizationId ?? null;
  const existing = await prisma.roleBinding.findFirst({
    where: {
      userId: input.userId,
      roleId: input.roleId,
      organizationId,
    },
  });
  if (existing) return { binding: existing, created: false };
  const binding = await prisma.roleBinding.create({
    data: {
      userId: input.userId,
      roleId: input.roleId,
      organizationId,
    },
  });
  return { binding, created: true };
}

export async function deleteRoleBinding(input: {
  userId: string;
  roleId: string;
  organizationId?: string | null;
}) {
  const organizationId = input.organizationId ?? null;
  const existing = await prisma.roleBinding.findFirst({
    where: {
      userId: input.userId,
      roleId: input.roleId,
      organizationId,
    },
  });
  if (!existing) return { deleted: false };
  await prisma.roleBinding.delete({ where: { id: existing.id } });
  return { deleted: true, bindingId: existing.id };
}

export async function listConfigurations() {
  return prisma.systemConfiguration.findMany({ orderBy: { key: "asc" } });
}

export async function getConfigurationByKey(key: string) {
  return prisma.systemConfiguration.findUnique({ where: { key } });
}

export async function upsertConfiguration(input: {
  key: string;
  value: Prisma.InputJsonValue;
  description?: string | null;
  updatedById?: string | null;
}) {
  return prisma.systemConfiguration.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      valueJson: input.value,
      description: input.description ?? null,
      updatedById: input.updatedById ?? null,
    },
    update: {
      valueJson: input.value,
      description: input.description === undefined ? undefined : input.description,
      updatedById: input.updatedById ?? null,
    },
  });
}

export async function listFeatureFlags(input?: { organizationId?: string | null }) {
  return prisma.featureFlag.findMany({
    where: input?.organizationId
      ? { OR: [{ organizationId: input.organizationId }, { organizationId: null }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function findFeatureFlagById(id: string) {
  return prisma.featureFlag.findUnique({ where: { id } });
}

export async function createFeatureFlag(input: {
  organizationId?: string | null;
  key: string;
  status?: string;
  rolloutPercent?: number;
  killSwitch?: boolean;
  targeting?: Record<string, unknown> | null;
  experiments?: Record<string, unknown> | null;
}) {
  const killSwitch = input.killSwitch ?? false;
  const status =
    killSwitch === true
      ? OpsEntityStates.suspended
      : (input.status ?? OpsEntityStates.inactive);
  return prisma.featureFlag.create({
    data: {
      publicCode: generateFeaturePublicCode(),
      organizationId: input.organizationId ?? null,
      key: input.key,
      status,
      rolloutPercent: input.rolloutPercent ?? 0,
      killSwitch,
      targetingJson: (input.targeting as Prisma.InputJsonValue) ?? undefined,
      experimentsJson: (input.experiments as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

export async function updateFeatureFlag(
  id: string,
  input: {
    status?: string;
    rolloutPercent?: number;
    killSwitch?: boolean;
    targeting?: Record<string, unknown> | null;
    experiments?: Record<string, unknown> | null;
  },
) {
  const data: Prisma.FeatureFlagUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.rolloutPercent !== undefined) data.rolloutPercent = input.rolloutPercent;
  if (input.killSwitch !== undefined) {
    data.killSwitch = input.killSwitch;
    if (input.killSwitch && input.status === undefined) {
      data.status = OpsEntityStates.suspended;
    }
  }
  if (input.targeting !== undefined) {
    data.targetingJson = (input.targeting as Prisma.InputJsonValue) ?? Prisma.DbNull;
  }
  if (input.experiments !== undefined) {
    data.experimentsJson = (input.experiments as Prisma.InputJsonValue) ?? Prisma.DbNull;
  }
  return prisma.featureFlag.update({ where: { id }, data });
}

export async function updateOrganizationRecord(
  organizationId: string,
  input: { name?: string; slug?: string; status?: string },
) {
  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
}

export async function updateUserAdminRecord(
  userId: string,
  input: { status?: string; firstName?: string | null; lastName?: string | null },
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    },
  });
}

export async function listAuditLogs(input: {
  action?: string;
  actorUserId?: string;
  targetType?: string;
  success?: boolean;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}) {
  const where: Prisma.AdminAuditLogWhereInput = {
    ...(input.action ? { action: input.action } : {}),
    ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
    ...(input.targetType ? { targetType: input.targetType } : {}),
    ...(input.success !== undefined ? { success: input.success } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lte: input.to } : {}),
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);
  return { items, total, limit: input.limit, offset: input.offset };
}
