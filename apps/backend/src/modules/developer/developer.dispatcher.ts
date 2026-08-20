import { prisma } from "@trustchain/database";
import { WebhookDeliveryStatuses } from "@trustchain/config";
import {
  listDueDeliveries,
  markDeliveryRetry,
  markDeliverySuccess,
  resolveRetryPolicy,
} from "./developer.delivery.js";
import { decryptSigningSecret, signOutgoingWebhook } from "./developer.signing.js";

export type DispatchResult = {
  deliveryId: string;
  ok: boolean;
  status?: number;
  deadLettered?: boolean;
  error?: string;
};

async function httpPost(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs = 15_000,
): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    return { status: res.status, body: text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispatch a single delivery immediately (used by test/replay and worker).
 */
export async function dispatchDelivery(deliveryId: string): Promise<DispatchResult> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });
  if (!delivery) {
    return { deliveryId, ok: false, error: "Delivery not found" };
  }

  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: delivery.webhookEndpointId },
  });
  if (!endpoint) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatuses.failed,
        attemptCount: delivery.attemptCount + 1,
        error: "Webhook endpoint missing",
        nextRetryAt: null,
      },
    });
    return { deliveryId, ok: false, error: "Webhook endpoint missing", deadLettered: true };
  }

  if (endpoint.status === "disabled") {
    return { deliveryId, ok: false, error: "Endpoint disabled" };
  }

  const policy = resolveRetryPolicy(endpoint.retryPolicyJson);
  let secret: string;
  try {
    secret = decryptSigningSecret(endpoint.secretHash);
  } catch {
    const attemptCount = delivery.attemptCount + 1;
    const result = await markDeliveryRetry(
      deliveryId,
      endpoint.id,
      attemptCount,
      policy,
      "Signing secret not recoverable",
      null,
      null,
    );
    return {
      deliveryId,
      ok: false,
      deadLettered: result.deadLettered,
      error: "Signing secret not recoverable",
    };
  }

  const signed = signOutgoingWebhook(
    secret,
    delivery.payloadJson,
    endpoint.id,
    delivery.id,
  );

  const attemptCount = delivery.attemptCount + 1;

  try {
    const res = await httpPost(endpoint.url, signed.body, signed.headers);
    if (res.status >= 200 && res.status < 300) {
      await markDeliverySuccess(deliveryId, res.status, res.body, endpoint.id);
      return { deliveryId, ok: true, status: res.status };
    }
    const result = await markDeliveryRetry(
      deliveryId,
      endpoint.id,
      attemptCount,
      policy,
      `HTTP ${res.status}`,
      res.status,
      res.body,
    );
    return {
      deliveryId,
      ok: false,
      status: res.status,
      deadLettered: result.deadLettered,
      error: `HTTP ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result = await markDeliveryRetry(
      deliveryId,
      endpoint.id,
      attemptCount,
      policy,
      message,
      null,
      null,
    );
    return {
      deliveryId,
      ok: false,
      deadLettered: result.deadLettered,
      error: message,
    };
  }
}

/** Process due pending/retrying deliveries (worker / on-demand flush). */
export async function dispatchDueDeliveries(limit = 25): Promise<DispatchResult[]> {
  const due = await listDueDeliveries(limit);
  const results: DispatchResult[] = [];
  for (const d of due) {
    results.push(await dispatchDelivery(d.id));
  }
  return results;
}
