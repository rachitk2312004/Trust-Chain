import { prisma } from "@trustchain/database";

export type MembershipRow = {
  id: string;
  organization_id: string;
  user_id: string;
  branch_id: string | null;
  department_id: string | null;
  title: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

function toMembershipRow(row: {
  id: string;
  organizationId: string;
  userId: string;
  branchId: string | null;
  departmentId: string | null;
  title: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): MembershipRow {
  return {
    id: row.id,
    organization_id: row.organizationId,
    user_id: row.userId,
    branch_id: row.branchId,
    department_id: row.departmentId,
    title: row.title,
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function createMembership(input: {
  organizationId: string;
  userId: string;
  branchId?: string | null;
  departmentId?: string | null;
  title?: string | null;
  status?: string;
}): Promise<MembershipRow> {
  const row = await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
    create: {
      organizationId: input.organizationId,
      userId: input.userId,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      title: input.title ?? null,
      status: input.status ?? "active",
    },
    update: {
      status: input.status ?? "active",
      branchId: input.branchId ?? undefined,
      departmentId: input.departmentId ?? undefined,
      title: input.title ?? undefined,
    },
  });
  return toMembershipRow(row);
}

export async function findMembership(
  organizationId: string,
  userId: string,
): Promise<MembershipRow | null> {
  const row = await prisma.membership.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });
  return row ? toMembershipRow(row) : null;
}
