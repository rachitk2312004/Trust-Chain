import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../lib/errors.js";

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
};

function envFlag(name: string): boolean {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function razorpayKeyId(): string | null {
  const value = process.env.RAZORPAY_KEY_ID?.trim();
  return value ? value : null;
}

export function razorpayKeySecret(): string | null {
  const value = process.env.RAZORPAY_KEY_SECRET?.trim();
  return value ? value : null;
}

export function razorpayWebhookSecret(): string | null {
  const value = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  return value ? value : null;
}

export function razorpayMockEnabled(): boolean {
  if (razorpayKeyId() && razorpayKeySecret()) return false;
  if (envFlag("RAZORPAY_MOCK")) return true;
  return process.env.NODE_ENV !== "production";
}

export function hmacSha256Hex(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signaturesMatch(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "utf8");
  const actual = Buffer.from(actualHex, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string | null;
}): boolean {
  const secret = input.secret ?? razorpayKeySecret();
  if (!secret) {
    if (razorpayMockEnabled() && input.signature.startsWith("mock_")) return true;
    return false;
  }
  const expected = hmacSha256Hex(`${input.orderId}|${input.paymentId}`, secret);
  return signaturesMatch(expected, input.signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret?: string | null): boolean {
  const webhookSecret = secret ?? razorpayWebhookSecret() ?? razorpayKeySecret();
  if (!webhookSecret) {
    return razorpayMockEnabled() && signature.startsWith("mock_");
  }
  const expected = hmacSha256Hex(rawBody, webhookSecret);
  return signaturesMatch(expected, signature);
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (razorpayMockEnabled()) {
    return {
      id: `order_mock_${input.receipt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 14)}`,
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      status: "created",
    };
  }

  const keyId = razorpayKeyId();
  const secret = razorpayKeySecret();
  if (!keyId || !secret) {
    throw new AppError(
      503,
      "BILLING_NOT_CONFIGURED",
      "Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or RAZORPAY_MOCK=true for local checkout.",
    );
  }

  const auth = Buffer.from(`${keyId}:${secret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
      payment_capture: 1,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    amount?: number;
    currency?: string;
    receipt?: string;
    status?: string;
    error?: { description?: string };
  };

  if (!response.ok || !body.id) {
    throw new AppError(
      502,
      "RAZORPAY_ORDER_FAILED",
      body.error?.description ?? "Could not create Razorpay order",
    );
  }

  return {
    id: body.id,
    amount: Number(body.amount ?? input.amountPaise),
    currency: body.currency ?? input.currency,
    receipt: body.receipt ?? input.receipt,
    status: body.status ?? "created",
  };
}

export type RazorpayPayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  orderId: string;
  captured: boolean;
  method: string | null;
};

function razorpayBasicAuth(): string {
  const keyId = razorpayKeyId();
  const secret = razorpayKeySecret();
  if (!keyId || !secret) {
    throw new AppError(
      503,
      "BILLING_NOT_CONFIGURED",
      "Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }
  return Buffer.from(`${keyId}:${secret}`).toString("base64");
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  const auth = razorpayBasicAuth();
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    amount?: number;
    currency?: string;
    order_id?: string;
    captured?: boolean;
    method?: string;
    error?: { description?: string };
  };
  if (!response.ok || !body.id) {
    throw new AppError(
      502,
      "RAZORPAY_PAYMENT_LOOKUP_FAILED",
      body.error?.description ?? "Could not load Razorpay payment",
    );
  }
  return {
    id: body.id,
    status: body.status ?? "",
    amount: Number(body.amount ?? 0),
    currency: body.currency ?? "INR",
    orderId: body.order_id ?? "",
    captured: Boolean(body.captured),
    method: body.method ?? null,
  };
}

export async function assertCapturedRazorpayPayment(input: {
  paymentId: string;
  orderId: string;
  amountPaise: number;
}): Promise<RazorpayPayment> {
  const payment = await fetchRazorpayPayment(input.paymentId);
  if (payment.orderId !== input.orderId) {
    throw new AppError(400, "RAZORPAY_PAYMENT_MISMATCH", "Payment does not belong to this order");
  }
  if (payment.amount !== input.amountPaise) {
    throw new AppError(400, "RAZORPAY_PAYMENT_MISMATCH", "Payment amount does not match the order");
  }
  const accepted = payment.status === "captured" || payment.status === "authorized";
  if (!accepted) {
    throw new AppError(400, "RAZORPAY_PAYMENT_INCOMPLETE", "Payment has not been captured yet");
  }
  return payment;
}
