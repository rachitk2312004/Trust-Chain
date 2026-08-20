import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookVerificationResult } from "./types.js";

export function parseWebhookSignatureHeader(
  header: string,
): { timestamp: string; signature: string } | null {
  const parts = header.split(",").map((p) => p.trim());
  let timestamp = "";
  let signature = "";
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === "t") timestamp = v;
    if (k === "v1") signature = v;
  }
  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}

export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/**
 * Verify TrustChain webhook signatures (`X-TrustChain-Signature: t=…,v1=…`).
 * Does not call the network — local HMAC + timestamp tolerance only.
 */
export function verifyWebhook(input: {
  secret: string;
  body: string | Buffer;
  signatureHeader: string;
  toleranceSeconds?: number;
  nowSec?: number;
}): WebhookVerificationResult {
  const parsed = parseWebhookSignatureHeader(input.signatureHeader);
  if (!parsed) {
    return { valid: false, timestamp: null, signature: null, reason: "invalid_header" };
  }

  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? 300;
  const ts = Number.parseInt(parsed.timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > tolerance) {
    return {
      valid: false,
      timestamp: parsed.timestamp,
      signature: parsed.signature,
      reason: "timestamp_out_of_tolerance",
    };
  }

  const body = typeof input.body === "string" ? input.body : input.body.toString("utf8");
  const expected = signWebhookPayload(input.secret, parsed.timestamp, body);
  try {
    const a = Buffer.from(parsed.signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return {
        valid: false,
        timestamp: parsed.timestamp,
        signature: parsed.signature,
        reason: "signature_mismatch",
      };
    }
  } catch {
    return {
      valid: false,
      timestamp: parsed.timestamp,
      signature: parsed.signature,
      reason: "signature_mismatch",
    };
  }

  return { valid: true, timestamp: parsed.timestamp, signature: parsed.signature };
}

export class WebhooksResource {
  verify = verifyWebhook;
  sign = signWebhookPayload;
  parseSignatureHeader = parseWebhookSignatureHeader;
}
