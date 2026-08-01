import { prisma } from "@trustchain/database";

export async function bindRoleToUser(input: {
  userId: string;
  roleKey: string;
  organizationId?: string | null;
}): Promise<void> {
  const role = await prisma.role.findUnique({ where: { key: input.roleKey } });
  if (!role) {
    throw new Error(`Role not found: ${input.roleKey}`);
  }

  const organizationId = input.organizationId ?? null;

  const existing = await prisma.roleBinding.findFirst({
    where: {
      userId: input.userId,
      roleId: role.id,
      organizationId,
    },
  });

  if (existing) {
    return;
  }

  await prisma.roleBinding.create({
    data: {
      userId: input.userId,
      roleId: role.id,
      organizationId,
    },
  });
}

export async function bindPublicUserRole(userId: string): Promise<void> {
  await bindRoleToUser({ userId, roleKey: "public_user" });
}
