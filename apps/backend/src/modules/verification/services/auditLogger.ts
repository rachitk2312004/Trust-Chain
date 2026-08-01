import { prisma, type Prisma } from "@trustchain/database";

export async function writeVerificationAudit(input: {
  requestId: string;
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.verificationAuditEntry.create({
    data: {
      requestId: input.requestId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      metadata: input.metadata ?? undefined,
    },
  });
}
