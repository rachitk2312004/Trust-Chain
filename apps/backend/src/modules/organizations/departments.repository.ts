import { prisma } from "@trustchain/database";

export type DepartmentRow = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  name: string;
  code: string | null;
  created_at: Date;
  updated_at: Date;
};

function toDepartmentRow(row: {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  code: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DepartmentRow {
  return {
    id: row.id,
    organization_id: row.organizationId,
    branch_id: row.branchId,
    name: row.name,
    code: row.code,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function createDepartment(input: {
  organizationId: string;
  name: string;
  code?: string;
  branchId?: string | null;
}): Promise<DepartmentRow> {
  const row = await prisma.department.create({
    data: {
      organizationId: input.organizationId,
      branchId: input.branchId ?? null,
      name: input.name,
      code: input.code ?? null,
    },
  });
  return toDepartmentRow(row);
}

export async function listDepartments(organizationId: string): Promise<DepartmentRow[]> {
  const rows = await prisma.department.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
  return rows.map(toDepartmentRow);
}

export async function updateDepartment(
  organizationId: string,
  departmentId: string,
  input: Partial<{ name: string; code: string | null; branchId: string | null }>,
): Promise<DepartmentRow | null> {
  const result = await prisma.department.updateMany({
    where: { id: departmentId, organizationId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
    },
  });
  if (result.count === 0) return null;
  const row = await prisma.department.findFirst({ where: { id: departmentId, organizationId } });
  return row ? toDepartmentRow(row) : null;
}

export async function deleteDepartment(
  organizationId: string,
  departmentId: string,
): Promise<boolean> {
  const result = await prisma.department.deleteMany({
    where: { id: departmentId, organizationId },
  });
  return result.count > 0;
}

export function toPublicDepartment(row: DepartmentRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    branchId: row.branch_id,
    name: row.name,
    code: row.code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
