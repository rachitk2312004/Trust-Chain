import { prisma } from "@trustchain/database";

export async function recordPublicEvent(input: {
  organizationId?: string | null;
  documentId?: string | null;
  linkId?: string | null;
  tokenId?: string | null;
  verificationCode?: string | null;
  publicVerifyCode?: string | null;
  lookupType: string;
  lookupValueHash: string;
  outcome?: string | null;
  success: boolean;
  errorCode?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
}): Promise<void> {
  await prisma.publicVerificationEvent.create({
    data: {
      organizationId: input.organizationId ?? null,
      documentId: input.documentId ?? null,
      linkId: input.linkId ?? null,
      tokenId: input.tokenId ?? null,
      verificationCode: input.verificationCode ?? null,
      publicVerifyCode: input.publicVerifyCode ?? null,
      lookupType: input.lookupType,
      lookupValueHash: input.lookupValueHash,
      outcome: input.outcome ?? null,
      success: input.success,
      errorCode: input.errorCode ?? null,
      ipHash: input.ipHash ?? null,
      userAgentHash: input.userAgentHash ?? null,
    },
  });

  if (input.organizationId) {
    await bumpAnalytics({
      organizationId: input.organizationId,
      documentId: input.documentId ?? null,
      outcome: input.outcome,
      success: input.success,
      blocked: input.errorCode === "PUBLIC_VERIFY_BLOCKED",
    });
  }
}

async function bumpAnalytics(input: {
  organizationId: string;
  documentId: string | null;
  outcome?: string | null;
  success: boolean;
  blocked: boolean;
}): Promise<void> {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.publicVerificationAnalytics.findFirst({
    where: {
      organizationId: input.organizationId,
      documentId: input.documentId,
      day,
    },
  });

  const outcomeField =
    input.outcome === "valid"
      ? "validCount"
      : input.outcome === "invalid"
        ? "invalidCount"
        : input.outcome === "revoked"
          ? "revokedCount"
          : input.outcome === "expired"
            ? "expiredCount"
            : input.outcome === "missing"
              ? "missingCount"
              : input.outcome === "tampered"
                ? "tamperedCount"
                : null;

  if (existing) {
    await prisma.publicVerificationAnalytics.update({
      where: { id: existing.id },
      data: {
        totalLookups: { increment: 1 },
        errorCount: input.success ? undefined : { increment: 1 },
        blockedCount: input.blocked ? { increment: 1 } : undefined,
        ...(outcomeField ? { [outcomeField]: { increment: 1 } } : {}),
      },
    });
    return;
  }

  await prisma.publicVerificationAnalytics.create({
    data: {
      organizationId: input.organizationId,
      documentId: input.documentId,
      day,
      totalLookups: 1,
      validCount: input.outcome === "valid" ? 1 : 0,
      invalidCount: input.outcome === "invalid" ? 1 : 0,
      revokedCount: input.outcome === "revoked" ? 1 : 0,
      expiredCount: input.outcome === "expired" ? 1 : 0,
      missingCount: input.outcome === "missing" ? 1 : 0,
      tamperedCount: input.outcome === "tampered" ? 1 : 0,
      errorCount: input.success ? 0 : 1,
      blockedCount: input.blocked ? 1 : 0,
    },
  });
}
