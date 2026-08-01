import { VerificationRateLimit } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";

/** Simple Postgres-backed rate limit using recent verification_requests rows. */
export async function assertVerificationRateLimit(
  userId: string,
  organizationId: string,
): Promise<void> {
  const since = new Date(Date.now() - VerificationRateLimit.windowMs);
  const count = await prisma.verificationRequest.count({
    where: {
      organizationId,
      requestedByUserId: userId,
      createdAt: { gte: since },
    },
  });
  if (count >= VerificationRateLimit.maxRequests) {
    throw new AppError(429, "VERIFY_RATE_LIMITED", "Verification rate limit exceeded", {
      maxRequests: VerificationRateLimit.maxRequests,
      windowMs: VerificationRateLimit.windowMs,
    });
  }
}
