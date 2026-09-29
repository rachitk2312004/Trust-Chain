import { prisma } from "@trustchain/database";

export function normalizeRecipientEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return email || null;
}

/**
 * Attach issued certificates that were addressed to this email before the
 * holder had a TrustChain account (single issue or bulk CSV).
 */
export async function claimCertificatesForUser(userId: string, email: string | null | undefined) {
  const normalized = normalizeRecipientEmail(email);
  if (!normalized) return { claimed: 0 };

  const result = await prisma.certificate.updateMany({
    where: {
      recipientUserId: null,
      recipientEmail: { equals: normalized, mode: "insensitive" },
    },
    data: { recipientUserId: userId },
  });

  return { claimed: result.count };
}
