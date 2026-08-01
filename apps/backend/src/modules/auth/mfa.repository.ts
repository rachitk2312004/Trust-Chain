import { prisma } from "@trustchain/database";

export type MfaFactorRow = {
  id: string;
  user_id: string;
  type: "totp";
  secret_encrypted: string;
  verified_at: Date | null;
  disabled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function toMfaRow(row: {
  id: string;
  userId: string;
  type: string;
  secretEncrypted: string;
  verifiedAt: Date | null;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MfaFactorRow {
  return {
    id: row.id,
    user_id: row.userId,
    type: "totp",
    secret_encrypted: row.secretEncrypted,
    verified_at: row.verifiedAt,
    disabled_at: row.disabledAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function findActiveMfaFactor(userId: string): Promise<MfaFactorRow | null> {
  const row = await prisma.mfaFactor.findFirst({
    where: {
      userId,
      type: "totp",
      verifiedAt: { not: null },
      disabledAt: null,
    },
    orderBy: { verifiedAt: "desc" },
  });
  return row ? toMfaRow(row) : null;
}

export async function findPendingMfaFactor(userId: string): Promise<MfaFactorRow | null> {
  const row = await prisma.mfaFactor.findFirst({
    where: {
      userId,
      type: "totp",
      verifiedAt: null,
      disabledAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  return row ? toMfaRow(row) : null;
}

export async function createPendingMfaFactor(
  userId: string,
  secretEncrypted: string,
): Promise<MfaFactorRow> {
  await prisma.mfaFactor.updateMany({
    where: { userId, verifiedAt: null, disabledAt: null },
    data: { disabledAt: new Date() },
  });

  const row = await prisma.mfaFactor.create({
    data: {
      userId,
      type: "totp",
      secretEncrypted,
    },
  });
  return toMfaRow(row);
}

export async function markMfaFactorVerified(id: string): Promise<MfaFactorRow> {
  const row = await prisma.mfaFactor.update({
    where: { id },
    data: { verifiedAt: new Date() },
  });
  return toMfaRow(row);
}

export async function disableMfaFactorsForUser(userId: string): Promise<void> {
  await prisma.mfaFactor.updateMany({
    where: { userId, disabledAt: null },
    data: { disabledAt: new Date() },
  });
}

export async function userHasMfaEnabled(userId: string): Promise<boolean> {
  const factor = await findActiveMfaFactor(userId);
  return Boolean(factor);
}
