import { prisma } from "@trustchain/database";
import { toUserRow, type UserRow } from "./user.types.js";

export type { UserRow };

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      deletedAt: null,
    },
  });
  return user ? toUserRow(user) : null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });
  return user ? toUserRow(user) : null;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
}): Promise<UserRow> {
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      status: "pending",
    },
  });
  return toUserRow(user);
}

export async function markEmailVerified(userId: string): Promise<UserRow> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifiedAt: new Date(),
      status: "active",
    },
  });
  return toUserRow(user);
}

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export function toPublicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    status: user.status,
    emailVerifiedAt: user.email_verified_at,
    createdAt: user.created_at,
  };
}
