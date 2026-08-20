import { createHash } from "node:crypto";
import { ApiIdempotencyTtlMs } from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";

export function normalizeIdempotencyKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 200) {
    throw new AppError(400, "VALIDATION_ERROR", "Idempotency-Key too long");
  }
  return trimmed;
}

export function hashRequestPayload(input: {
  method: string;
  path: string;
  body: unknown;
}): string {
  const canonical = JSON.stringify({
    method: input.method.toUpperCase(),
    path: input.path,
    body: input.body ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function findIdempotencyRecord(input: {
  organizationId: string;
  apiKeyId: string;
  idempotencyKey: string;
}) {
  const now = new Date();
  return prisma.apiIdempotencyRecord.findFirst({
    where: {
      organizationId: input.organizationId,
      apiKeyId: input.apiKeyId,
      idempotencyKey: input.idempotencyKey,
      expiresAt: { gt: now },
    },
  });
}

export async function saveIdempotencyRecord(input: {
  organizationId: string;
  apiKeyId: string;
  idempotencyKey: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  ttlMs?: number;
}) {
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? ApiIdempotencyTtlMs));
  return prisma.apiIdempotencyRecord.upsert({
    where: {
      organizationId_apiKeyId_idempotencyKey: {
        organizationId: input.organizationId,
        apiKeyId: input.apiKeyId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    create: {
      organizationId: input.organizationId,
      apiKeyId: input.apiKeyId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      responseStatus: input.responseStatus,
      responseBody: input.responseBody as Prisma.InputJsonValue,
      expiresAt,
    },
    update: {
      requestHash: input.requestHash,
      responseStatus: input.responseStatus,
      responseBody: input.responseBody as Prisma.InputJsonValue,
      expiresAt,
    },
  });
}

export function assertIdempotencyRequestMatch(
  storedHash: string,
  incomingHash: string,
): void {
  if (storedHash !== incomingHash) {
    throw new AppError(
      409,
      "IDEMPOTENCY_KEY_REUSE",
      "Idempotency-Key was already used with a different request payload",
    );
  }
}
