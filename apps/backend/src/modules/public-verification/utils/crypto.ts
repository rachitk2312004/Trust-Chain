import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PublicReportTtlMs, PublicVerifyUrlPaths } from "@trustchain/config";

export function generatePublicCode(prefix: "PUB-VERIFY" | "PUB-LINK"): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${suffix}`;
}

export function mintRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function hashOpaque(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function getPublicVerifyBaseUrl(): string {
  return (process.env.PUBLIC_VERIFY_BASE_URL ?? "https://verify.trustchain.com").replace(/\/$/, "");
}

export function getSigningSecret(): string {
  const secret = process.env.PUBLIC_VERIFY_SIGNING_SECRET ?? process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("PUBLIC_VERIFY_SIGNING_SECRET or JWT_ACCESS_SECRET is required");
  }
  return secret;
}

export function buildPublicUrls(input: {
  rawToken?: string;
  hash?: string;
  verificationCode?: string;
  publicVerifyCode?: string;
  transactionHash?: string;
}): Record<string, string | null> {
  const base = getPublicVerifyBaseUrl();
  return {
    link: input.rawToken
      ? `${base}${PublicVerifyUrlPaths.link.replace("{token}", input.rawToken)}`
      : null,
    hash: input.hash ? `${base}${PublicVerifyUrlPaths.hash.replace("{hash}", input.hash)}` : null,
    verify: input.verificationCode
      ? `${base}${PublicVerifyUrlPaths.verify.replace("{code}", input.verificationCode)}`
      : null,
    document: input.publicVerifyCode
      ? `${base}${PublicVerifyUrlPaths.document.replace("{publicVerifyCode}", input.publicVerifyCode)}`
      : null,
    tx: input.transactionHash
      ? `${base}${PublicVerifyUrlPaths.tx.replace("{transactionHash}", input.transactionHash)}`
      : null,
  };
}

export type SignedPublicReport = {
  reportSignature: string;
  reportChecksum: string;
  issuedAt: string;
  expiresAt: string;
};

/** Canonical JSON for checksum (stable key order for known fields). */
export function computeReportChecksum(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return createHash("sha256").update(json).digest("hex");
}

export function signPublicReport(
  payload: Record<string, unknown>,
  ttlMs = PublicReportTtlMs,
): SignedPublicReport {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlMs);
  const checksum = computeReportChecksum(payload);
  const toSign = `${checksum}.${issuedAt.toISOString()}.${expiresAt.toISOString()}`;
  const reportSignature = createHmac("sha256", getSigningSecret()).update(toSign).digest("hex");
  return {
    reportSignature,
    reportChecksum: checksum,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function verifyReportSignature(input: {
  payload: Record<string, unknown>;
  reportSignature: string;
  reportChecksum: string;
  issuedAt: string;
  expiresAt: string;
}): boolean {
  if (new Date(input.expiresAt) <= new Date()) return false;
  const checksum = computeReportChecksum(input.payload);
  if (checksum !== input.reportChecksum) return false;
  const toSign = `${checksum}.${input.issuedAt}.${input.expiresAt}`;
  const expected = createHmac("sha256", getSigningSecret()).update(toSign).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(input.reportSignature, "hex"));
  } catch {
    return false;
  }
}
