import { prisma } from "@trustchain/database";

export type DeviceRow = {
  id: string;
  user_id: string;
  name: string | null;
  fingerprint: string | null;
  user_agent: string | null;
  trusted: boolean;
  last_seen_at: Date;
  created_at: Date;
  revoked_at: Date | null;
};

function toDeviceRow(row: {
  id: string;
  userId: string;
  name: string | null;
  fingerprint: string | null;
  userAgent: string | null;
  trusted: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}): DeviceRow {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    fingerprint: row.fingerprint,
    user_agent: row.userAgent,
    trusted: row.trusted,
    last_seen_at: row.lastSeenAt,
    created_at: row.createdAt,
    revoked_at: row.revokedAt,
  };
}

export async function upsertDevice(input: {
  userId: string;
  name?: string;
  fingerprint?: string;
  userAgent?: string;
}): Promise<DeviceRow> {
  if (input.fingerprint) {
    const existing = await prisma.device.findFirst({
      where: {
        userId: input.userId,
        fingerprint: input.fingerprint,
        revokedAt: null,
      },
    });
    if (existing) {
      const updated = await prisma.device.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          userAgent: input.userAgent ?? existing.userAgent,
          name: input.name ?? existing.name,
        },
      });
      return toDeviceRow(updated);
    }
  }

  const created = await prisma.device.create({
    data: {
      userId: input.userId,
      name: input.name ?? null,
      fingerprint: input.fingerprint ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
  return toDeviceRow(created);
}

export async function listDevicesForUser(userId: string): Promise<DeviceRow[]> {
  const rows = await prisma.device.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
  });
  return rows.map(toDeviceRow);
}

export async function revokeDevice(userId: string, deviceId: string): Promise<boolean> {
  const result = await prisma.device.updateMany({
    where: { id: deviceId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}
