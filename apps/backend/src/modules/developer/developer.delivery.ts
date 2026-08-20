import { Prisma, prisma } from "@trustchain/database";
import {
  DefaultWebhookRetryPolicy,
  WebhookDeliveryStatuses,
  type DeveloperEventType,
} from "@trustchain/config";
import { nextBackoffMs, parseRetryPolicy, type WebhookRetryPolicy } from "./developer.retry.js";

export type PublishDeveloperEventInput = {
  organizationId: string;
  eventType: DeveloperEventType | string;
  data: Record<string, unknown>;
  eventId?: string;
};

function newEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * Publish a developer event to all matching active webhook endpoints for the org.
 * Creates pending delivery rows scheduled for immediate dispatch.
 */
export async function publishDeveloperEvent(
  input: PublishDeveloperEventInput,
): Promise<{ eventId: string; deliveryIds: string[] }> {
  const eventId = input.eventId ?? newEventId();
  const now = new Date();

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      organizationId: input.organizationId,
      status: "active",
    },
  });

  const matching = endpoints.filter((ep) => {
    const events = asStringArray(ep.eventsJson);
    return events.includes(input.eventType) || events.includes("*");
  });

  const deliveryIds: string[] = [];

  for (const ep of matching) {
    const row = await prisma.webhookDelivery.create({
      data: {
        organizationId: input.organizationId,
        webhookEndpointId: ep.id,
        eventType: input.eventType,
        payloadJson: asJson({
          id: eventId,
          type: input.eventType,
          created_at: now.toISOString(),
          data: input.data,
        }),
        status: WebhookDeliveryStatuses.pending,
        attemptCount: 0,
        nextRetryAt: now,
      },
    });
    deliveryIds.push(row.id);
  }

  return { eventId, deliveryIds };
}

/** Fire-and-forget publish — never throws to callers. */
export function publishDeveloperEventSafe(input: PublishDeveloperEventInput): void {
  void publishDeveloperEvent(input).catch(() => {
    /* swallow — delivery failures are tracked on delivery rows */
  });
}

export async function scheduleDelivery(
  deliveryId: string,
  nextRetryAt: Date,
): Promise<void> {
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      nextRetryAt,
      status: WebhookDeliveryStatuses.pending,
    },
  });
}

export async function listDueDeliveries(limit = 50) {
  const now = new Date();
  return prisma.webhookDelivery.findMany({
    where: {
      status: { in: [WebhookDeliveryStatuses.pending, WebhookDeliveryStatuses.retrying] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    take: limit,
    orderBy: { nextRetryAt: "asc" },
  });
}

export async function markDeliverySuccess(
  deliveryId: string,
  responseStatus: number,
  responseBody: string | null,
  webhookEndpointId: string,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatuses.success,
        responseStatus,
        responseBody: responseBody?.slice(0, 4000) ?? null,
        nextRetryAt: null,
        error: null,
      },
    }),
    prisma.webhookEndpoint.update({
      where: { id: webhookEndpointId },
      data: {
        lastDeliveredAt: now,
        failureCount: 0,
      },
    }),
  ]);
}

export async function markDeliveryRetry(
  deliveryId: string,
  webhookEndpointId: string,
  attemptCount: number,
  policy: WebhookRetryPolicy,
  error: string,
  responseStatus: number | null,
  responseBody: string | null,
): Promise<{ deadLettered: boolean; nextRetryAt: Date | null }> {
  if (attemptCount >= policy.maxAttempts) {
    await prisma.$transaction([
      prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: WebhookDeliveryStatuses.failed,
          attemptCount,
          nextRetryAt: null,
          error: error.slice(0, 2000),
          responseStatus,
          responseBody: responseBody?.slice(0, 4000) ?? null,
        },
      }),
      prisma.webhookEndpoint.update({
        where: { id: webhookEndpointId },
        data: {
          failureCount: { increment: 1 },
          status: "failing",
        },
      }),
    ]);
    return { deadLettered: true, nextRetryAt: null };
  }

  const delay = nextBackoffMs(attemptCount, policy);
  const nextRetryAt = new Date(Date.now() + delay);
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: WebhookDeliveryStatuses.retrying,
      attemptCount,
      nextRetryAt,
      error: error.slice(0, 2000),
      responseStatus,
      responseBody: responseBody?.slice(0, 4000) ?? null,
    },
  });
  return { deadLettered: false, nextRetryAt };
}

export async function createTestDelivery(input: {
  organizationId: string;
  webhookEndpointId: string;
  eventType?: string;
  data?: Record<string, unknown>;
}) {
  const now = new Date();
  const eventType = input.eventType ?? "webhook.test";
  const eventId = newEventId();
  return prisma.webhookDelivery.create({
    data: {
      organizationId: input.organizationId,
      webhookEndpointId: input.webhookEndpointId,
      eventType,
      payloadJson: asJson({
        id: eventId,
        type: eventType,
        created_at: now.toISOString(),
        data: input.data ?? { message: "TrustChain webhook test event" },
      }),
      status: WebhookDeliveryStatuses.pending,
      attemptCount: 0,
      nextRetryAt: now,
    },
  });
}

export async function createReplayDelivery(source: {
  id: string;
  organizationId: string;
  webhookEndpointId: string;
  eventType: string;
  payloadJson: Prisma.JsonValue | null;
}) {
  const now = new Date();
  const base =
    source.payloadJson && typeof source.payloadJson === "object" && !Array.isArray(source.payloadJson)
      ? { ...(source.payloadJson as Record<string, unknown>) }
      : { data: source.payloadJson };

  return prisma.webhookDelivery.create({
    data: {
      organizationId: source.organizationId,
      webhookEndpointId: source.webhookEndpointId,
      eventType: source.eventType,
      payloadJson: asJson({
        ...base,
        replay_of: source.id,
        replayed_at: now.toISOString(),
      }),
      status: WebhookDeliveryStatuses.pending,
      attemptCount: 0,
      nextRetryAt: now,
    },
  });
}

export function resolveRetryPolicy(raw: unknown): WebhookRetryPolicy {
  return parseRetryPolicy(raw) ?? { ...DefaultWebhookRetryPolicy };
}

export async function getDelivery(deliveryId: string) {
  return prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
}

export async function listDeliveriesForWebhook(input: {
  webhookEndpointId: string;
  organizationId: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.WebhookDeliveryWhereInput = {
    webhookEndpointId: input.webhookEndpointId,
    organizationId: input.organizationId,
  };
  if (input.status) where.status = input.status;

  const [items, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 50,
      skip: input.offset ?? 0,
    }),
    prisma.webhookDelivery.count({ where }),
  ]);
  return { items, total };
}
