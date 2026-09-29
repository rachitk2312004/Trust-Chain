import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { fulfillPaidRazorpayOrder, markRazorpayOrderFailed } from "./billing.service.js";
import { verifyWebhookSignature } from "./billing.razorpay.js";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.header("x-razorpay-signature") ?? "";
  const raw = Buffer.isBuffer(req.body)
    ? req.body.toString("utf8")
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body ?? {});

  if (!verifyWebhookSignature(raw, signature)) {
    throw new AppError(400, "RAZORPAY_SIGNATURE_INVALID", "Webhook signature did not match");
  }

  const payload = (Buffer.isBuffer(req.body) ? JSON.parse(raw) : req.body) as {
    event?: string;
    payload?: { payment?: { entity?: Record<string, unknown> }; order?: { entity?: Record<string, unknown> } };
  };
  const event = payload.event ?? "";
  const payment = asRecord(payload.payload?.payment?.entity);
  const order = asRecord(payload.payload?.order?.entity);
  const orderId = String(payment.order_id ?? order.id ?? "");
  const paymentId = String(payment.id ?? "");

  if ((event === "payment.captured" || event === "order.paid") && orderId && paymentId) {
    await fulfillPaidRazorpayOrder(orderId, paymentId);
  }
  if (event === "payment.failed" && orderId) {
    await markRazorpayOrderFailed(orderId, paymentId || undefined);
  }

  res.status(200).json({ ok: true });
}
