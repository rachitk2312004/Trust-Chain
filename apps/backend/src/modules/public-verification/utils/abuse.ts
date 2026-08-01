import {
  PublicAbuseProtection,
  PublicVerificationLinkStatuses,
  PublicVerifyRateLimit,
  VerificationVisibility,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";
import { hashOpaque } from "../utils/crypto.js";

export function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  return req.ip ?? "0.0.0.0";
}

export async function assertNotAbusive(ip: string): Promise<string> {
  const ipHash = hashOpaque(ip);
  const now = new Date();
  const block = await prisma.publicAbuseBlock.findFirst({
    where: { ipHash, blockedUntil: { gt: now } },
    orderBy: { blockedUntil: "desc" },
  });
  if (block) {
    throw new AppError(429, "PUBLIC_VERIFY_BLOCKED", "Temporarily blocked due to abuse", {
      blockedUntil: block.blockedUntil,
      reputationScore: block.reputationScore,
    });
  }
  return ipHash;
}

export async function assertPublicRateLimit(ipHash: string): Promise<void> {
  const since = new Date(Date.now() - PublicVerifyRateLimit.windowMs);
  const count = await prisma.publicVerificationEvent.count({
    where: { ipHash, createdAt: { gte: since } },
  });
  if (count >= PublicVerifyRateLimit.maxRequests) {
    await registerAbuseStrike(ipHash, "rate_limit");
    throw new AppError(
      429,
      "PUBLIC_VERIFY_RATE_LIMITED",
      "Public verification rate limit exceeded",
    );
  }
}

/** IP reputation: recent failures increase score; high score triggers block. */
export async function registerAbuseStrike(ipHash: string, reason: string): Promise<void> {
  const existing = await prisma.publicAbuseBlock.findFirst({
    where: { ipHash },
    orderBy: { updatedAt: "desc" },
  });

  const strikeCount = (existing?.strikeCount ?? 0) + 1;
  const reputationScore = (existing?.reputationScore ?? 0) + 2;
  const exp = Math.min(
    PublicAbuseProtection.maxBlockMs,
    PublicAbuseProtection.baseBlockMs * 2 ** Math.max(0, strikeCount - 1),
  );
  const shouldBlock =
    strikeCount >= PublicAbuseProtection.strikeThreshold ||
    reputationScore >= PublicAbuseProtection.reputationBlockScore;

  const blockedUntil = new Date(Date.now() + (shouldBlock ? exp : 0));

  if (existing && existing.blockedUntil > new Date()) {
    await prisma.publicAbuseBlock.update({
      where: { id: existing.id },
      data: { strikeCount, reputationScore, reason, blockedUntil },
    });
    return;
  }

  if (shouldBlock) {
    await prisma.publicAbuseBlock.create({
      data: {
        ipHash,
        reason,
        strikeCount,
        reputationScore,
        blockedUntil,
      },
    });
  } else if (existing) {
    await prisma.publicAbuseBlock.update({
      where: { id: existing.id },
      data: { strikeCount, reputationScore, reason, blockedUntil: new Date() },
    });
  } else {
    await prisma.publicAbuseBlock.create({
      data: {
        ipHash,
        reason,
        strikeCount,
        reputationScore,
        blockedUntil: new Date(), // not actively blocked yet
      },
    });
  }
}

export function evaluateLinkStatus(input: {
  status: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  disabledAt: Date | null;
}): string {
  if (input.revokedAt || input.status === PublicVerificationLinkStatuses.revoked) {
    return PublicVerificationLinkStatuses.revoked;
  }
  if (input.disabledAt || input.status === PublicVerificationLinkStatuses.disabled) {
    return PublicVerificationLinkStatuses.disabled;
  }
  if (
    (input.expiresAt && input.expiresAt <= new Date()) ||
    input.status === PublicVerificationLinkStatuses.expired
  ) {
    return PublicVerificationLinkStatuses.expired;
  }
  return PublicVerificationLinkStatuses.active;
}

export function isPubliclyVerifiableVisibility(visibility: string): boolean {
  return (
    visibility === VerificationVisibility.public || visibility === VerificationVisibility.restricted
  );
}
