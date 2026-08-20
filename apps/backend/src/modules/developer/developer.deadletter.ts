import { prisma } from "@trustchain/database";
import { WebhookDeliveryStatuses } from "@trustchain/config";

/**
 * Dead-letter queue: deliveries that exhausted retries (status = failed).
 */

export async function listDeadLetters(
  organizationId: string,
  webhookEndpointId?: string,
  limit = 50,
) {
  return prisma.webhookDelivery.findMany({
    where: {
      organizationId,
      status: WebhookDeliveryStatuses.failed,
      ...(webhookEndpointId ? { webhookEndpointId } : {}),
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });
}

export async function requeueDeadLetter(deliveryId: string, organizationId: string) {
  const row = await prisma.webhookDelivery.findFirst({
    where: {
      id: deliveryId,
      organizationId,
      status: WebhookDeliveryStatuses.failed,
    },
  });
  if (!row) return null;

  const now = new Date();
  return prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: WebhookDeliveryStatuses.pending,
      attemptCount: 0,
      nextRetryAt: now,
      error: null,
      responseStatus: null,
      responseBody: null,
    },
  });
}

export function isDeadLetterStatus(status: string): boolean {
  return status === WebhookDeliveryStatuses.failed;
}
