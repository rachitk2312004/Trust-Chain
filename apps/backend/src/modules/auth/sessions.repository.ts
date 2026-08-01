import { Prisma, prisma } from "@trustchain/database";

export type SessionRow = {
  id: string;
  user_id: string;
  device_id: string | null;
  refresh_token_hash: string;
  ip: string | null;
  user_agent: string | null;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
};

function toSessionRow(row: {
  id: string;
  userId: string;
  deviceId: string | null;
  refreshTokenHash: string;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  ip?: unknown;
}): SessionRow {
  return {
    id: row.id,
    user_id: row.userId,
    device_id: row.deviceId,
    refresh_token_hash: row.refreshTokenHash,
    ip: row.ip == null ? null : String(row.ip),
    user_agent: row.userAgent,
    expires_at: row.expiresAt,
    revoked_at: row.revokedAt,
    created_at: row.createdAt,
  };
}

export async function createSession(input: {
  userId: string;
  deviceId?: string | null;
  refreshTokenHash: string;
  expiresAt: Date;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<SessionRow> {
  const rows = await prisma.$queryRaw<SessionRow[]>(Prisma.sql`
    INSERT INTO sessions (user_id, device_id, refresh_token_hash, expires_at, ip, user_agent)
    VALUES (
      ${input.userId}::uuid,
      ${input.deviceId ?? null}::uuid,
      ${input.refreshTokenHash},
      ${input.expiresAt},
      ${input.ip ?? null}::inet,
      ${input.userAgent ?? null}
    )
    RETURNING
      id,
      user_id,
      device_id,
      refresh_token_hash,
      ip::text AS ip,
      user_agent,
      expires_at,
      revoked_at,
      created_at
  `);

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create session");
  }
  return row;
}

export async function findValidSessionByRefreshHash(
  refreshTokenHash: string,
): Promise<SessionRow | null> {
  const row = await prisma.session.findFirst({
    where: {
      refreshTokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  return row ? toSessionRow(row) : null;
}

export async function findValidSessionById(sessionId: string): Promise<SessionRow | null> {
  const row = await prisma.session.findFirst({
    where: {
      id: sessionId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  return row ? toSessionRow(row) : null;
}

export async function rotateSessionRefreshToken(
  sessionId: string,
  refreshTokenHash: string,
  expiresAt: Date,
): Promise<SessionRow> {
  const row = await prisma.session.update({
    where: { id: sessionId },
    data: { refreshTokenHash, expiresAt },
  });
  return toSessionRow(row);
}

export async function revokeSession(sessionId: string, userId?: string): Promise<boolean> {
  const result = await prisma.session.updateMany({
    where: {
      id: sessionId,
      ...(userId ? { userId } : {}),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

export async function revokeAllSessionsForDevice(userId: string, deviceId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, deviceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function listSessionsForUser(userId: string): Promise<SessionRow[]> {
  const rows = await prisma.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSessionRow);
}
