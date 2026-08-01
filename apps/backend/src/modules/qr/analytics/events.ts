import { prisma } from "@trustchain/database";

export async function recordQrEvent(input: {
  organizationId?: string | null;
  documentId?: string | null;
  qrCodeId?: string | null;
  qrPublicCode?: string | null;
  lookupType: string;
  outcome?: string | null;
  success: boolean;
  errorCode?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
  kind?: "scan" | "download";
}): Promise<void> {
  await prisma.qrVerificationEvent.create({
    data: {
      organizationId: input.organizationId ?? null,
      documentId: input.documentId ?? null,
      qrCodeId: input.qrCodeId ?? null,
      qrPublicCode: input.qrPublicCode ?? null,
      lookupType: input.lookupType,
      outcome: input.outcome ?? null,
      success: input.success,
      errorCode: input.errorCode ?? null,
      ipHash: input.ipHash ?? null,
      userAgentHash: input.userAgentHash ?? null,
    },
  });

  if (input.organizationId) {
    await bumpQrAnalytics({
      organizationId: input.organizationId,
      documentId: input.documentId ?? null,
      outcome: input.outcome,
      success: input.success,
      kind: input.kind ?? "scan",
    });
  }
}

async function bumpQrAnalytics(input: {
  organizationId: string;
  documentId: string | null;
  outcome?: string | null;
  success: boolean;
  kind: "scan" | "download";
}): Promise<void> {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.qrAnalytics.findFirst({
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
            : null;

  if (existing) {
    await prisma.qrAnalytics.update({
      where: { id: existing.id },
      data: {
        scanCount: input.kind === "scan" ? { increment: 1 } : undefined,
        downloadCount: input.kind === "download" ? { increment: 1 } : undefined,
        errorCount: input.success ? undefined : { increment: 1 },
        ...(outcomeField ? { [outcomeField]: { increment: 1 } } : {}),
      },
    });
    return;
  }

  await prisma.qrAnalytics.create({
    data: {
      organizationId: input.organizationId,
      documentId: input.documentId,
      day,
      scanCount: input.kind === "scan" ? 1 : 0,
      downloadCount: input.kind === "download" ? 1 : 0,
      validCount: input.outcome === "valid" ? 1 : 0,
      invalidCount: input.outcome === "invalid" ? 1 : 0,
      revokedCount: input.outcome === "revoked" ? 1 : 0,
      expiredCount: input.outcome === "expired" ? 1 : 0,
      errorCount: input.success ? 0 : 1,
    },
  });
}
