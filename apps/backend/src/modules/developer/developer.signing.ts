import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getSecretsKey(): Buffer {
  const raw = process.env.DEVELOPER_SECRETS_KEY;
  if (raw && Buffer.byteLength(raw) >= 32) {
    return Buffer.from(raw).subarray(0, 32);
  }
  return createHmac("sha256", "trustchain-developer-secrets")
    .update(raw ?? "local")
    .digest();
}

/** Encrypt a webhook signing secret for recoverable storage. */
export function encryptSigningSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getSecretsKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt a stored webhook signing secret. */
export function decryptSigningSecret(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Invalid ciphertext");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getSecretsKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function signWebhookBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function buildSignatureHeader(timestamp: string, signature: string): string {
  return `t=${timestamp},v1=${signature}`;
}

export function parseWebhookSignature(
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

/** Validate timestamp within toleranceSeconds (default 300) — replay protection. */
export function validateWebhookTimestamp(
  timestampSec: string,
  toleranceSeconds = 300,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  const ts = Number.parseInt(timestampSec, 10);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowSec - ts) <= toleranceSeconds;
}

/** Verify HMAC signature and timestamp (replay protection). */
export function verifyWebhookSignature(input: {
  secret: string;
  body: string;
  signatureHeader: string;
  toleranceSeconds?: number;
  nowSec?: number;
}): boolean {
  const parsed = parseWebhookSignature(input.signatureHeader);
  if (!parsed) return false;
  if (!validateWebhookTimestamp(parsed.timestamp, input.toleranceSeconds, input.nowSec)) {
    return false;
  }
  const expected = signWebhookBody(input.secret, parsed.timestamp, input.body);
  try {
    const a = Buffer.from(parsed.signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function signOutgoingWebhook(
  secret: string,
  payload: unknown,
  webhookId: string,
  deliveryId: string,
): { body: string; headers: Record<string, string> } {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signature = signWebhookBody(secret, timestamp, body);
  return {
    body,
    headers: {
      "Content-Type": "application/json",
      "X-TrustChain-Timestamp": timestamp,
      "X-TrustChain-Signature": buildSignatureHeader(timestamp, signature),
      "X-TrustChain-Webhook-Id": webhookId,
      "X-TrustChain-Delivery-Id": deliveryId,
    },
  };
}
