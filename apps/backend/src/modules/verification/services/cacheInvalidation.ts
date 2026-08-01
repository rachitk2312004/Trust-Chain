import { prisma } from "@trustchain/database";

/** Invalidate all verification cache rows for a document (and optionally org-wide). */
export async function invalidateVerificationCache(input: {
  organizationId: string;
  documentId?: string;
  reason: string;
}): Promise<number> {
  const result = await prisma.verificationCache.deleteMany({
    where: {
      organizationId: input.organizationId,
      ...(input.documentId ? { documentId: input.documentId } : {}),
    },
  });
  return result.count;
}

export async function invalidateVerificationCacheForDocument(
  organizationId: string,
  documentId: string,
  reason: string,
): Promise<void> {
  await invalidateVerificationCache({ organizationId, documentId, reason });
}
