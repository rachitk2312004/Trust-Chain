import { prisma } from "@trustchain/database";

export type EmailTokenPurpose = "email_verify" | "password_reset";

export type EmailTokenRow = {
  id: string;
  user_id: string;
  purpose: EmailTokenPurpose;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

export async function createEmailToken(input: {
  userId: string;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
}): Promise<EmailTokenRow> {
  const row = await prisma.emailToken.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    },
  });
  return {
    id: row.id,
    user_id: row.userId,
    purpose: row.purpose as EmailTokenPurpose,
    token_hash: row.tokenHash,
    expires_at: row.expiresAt,
    used_at: row.usedAt,
    created_at: row.createdAt,
  };
}

export async function findValidEmailToken(
  tokenHash: string,
  purpose: EmailTokenPurpose,
): Promise<EmailTokenRow | null> {
  const row = await prisma.emailToken.findFirst({
    where: {
      tokenHash,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.userId,
    purpose: row.purpose as EmailTokenPurpose,
    token_hash: row.tokenHash,
    expires_at: row.expiresAt,
    used_at: row.usedAt,
    created_at: row.createdAt,
  };
}

export async function markEmailTokenUsed(id: string): Promise<void> {
  await prisma.emailToken.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}

export async function invalidateEmailTokens(
  userId: string,
  purpose: EmailTokenPurpose,
): Promise<void> {
  await prisma.emailToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
}
