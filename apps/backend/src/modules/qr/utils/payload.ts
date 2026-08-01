import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { QrIntegrity, QrUrlPaths } from "@trustchain/config";
import {
  getPublicVerifyBaseUrl,
  getSigningSecret,
} from "../../public-verification/utils/crypto.js";
import type {
  QrIntegrityMeta,
  QrPayload,
  QrPayloadV1,
  QrPayloadV2,
  QrPayloadV3,
} from "../types/qr.types.js";

export function generateQrPublicCode(prefix: "QR" | "QR-TPL"): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${suffix}`;
}

export function buildQrScanUrl(rawToken: string): string {
  const base = getPublicVerifyBaseUrl();
  return `${base}${QrUrlPaths.scan.replace("{token}", rawToken)}`;
}

/** Stable canonical JSON (sorted keys) for hashing. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return value;
}

export function computePayloadChecksum(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

/** Distinct from checksum: hash of the wire string encoded into the QR. */
export function computePayloadHash(wirePayload: string): string {
  return createHash("sha256").update(wirePayload, "utf8").digest("hex");
}

export function signQrPayloadBody(body: Record<string, unknown>): string {
  const checksum = computePayloadChecksum(body);
  return createHmac("sha256", getSigningSecret()).update(checksum).digest("hex");
}

export function verifyQrSignature(input: {
  body: Record<string, unknown>;
  signature: string;
}): boolean {
  const expected = signQrPayloadBody(input.body);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(input.signature, "hex"));
  } catch {
    return false;
  }
}

export function buildIntegrityMeta(wirePayload: string, payloadObject: unknown): QrIntegrityMeta {
  return {
    payloadChecksum: computePayloadChecksum(payloadObject),
    payloadHash: computePayloadHash(wirePayload),
    signatureVersion: QrIntegrity.signatureVersion,
    algorithm: QrIntegrity.algorithm,
  };
}

export function buildPayloadV1(input: { rawToken: string; qrPublicCode: string }): {
  payload: QrPayloadV1;
  wire: string;
  integrity: QrIntegrityMeta;
} {
  const payload: QrPayloadV1 = {
    formatVersion: "V1",
    url: buildQrScanUrl(input.rawToken),
    qrPublicCode: input.qrPublicCode,
  };
  const wire = payload.url;
  return { payload, wire, integrity: buildIntegrityMeta(wire, payload) };
}

export function buildPayloadV2(input: {
  rawToken: string;
  qrPublicCode: string;
  publicVerifyCode: string | null;
  expiresAt: Date | null;
}): { payload: QrPayloadV2; wire: string; integrity: QrIntegrityMeta } {
  const issuedAt = new Date().toISOString();
  const expiresAt = input.expiresAt?.toISOString() ?? null;
  const url = buildQrScanUrl(input.rawToken);
  const unsigned = {
    formatVersion: "V2" as const,
    url,
    qrPublicCode: input.qrPublicCode,
    publicVerifyCode: input.publicVerifyCode,
    issuedAt,
    expiresAt,
    signatureVersion: QrIntegrity.signatureVersion,
    algorithm: QrIntegrity.algorithm,
  };
  const bodyForSign = { ...unsigned };
  const signature = signQrPayloadBody(bodyForSign);
  const payloadHash = computePayloadHash(canonicalJson(bodyForSign));
  const payload: QrPayloadV2 = {
    ...unsigned,
    signature,
    payloadHash,
  };
  const wire = canonicalJson(payload);
  return { payload, wire, integrity: buildIntegrityMeta(wire, payload) };
}

export function buildPayloadV3(input: {
  rawToken: string;
  qrPublicCode: string;
  publicVerifyCode: string | null;
  contentHash: string | null;
  networkName: string | null;
  transactionHash: string | null;
  blockNumber: string | null;
  expiresAt: Date | null;
}): { payload: QrPayloadV3; wire: string; integrity: QrIntegrityMeta } {
  const issuedAt = new Date().toISOString();
  const expiresAt = input.expiresAt?.toISOString() ?? null;
  const url = buildQrScanUrl(input.rawToken);
  const unsigned = {
    formatVersion: "V3" as const,
    url,
    qrPublicCode: input.qrPublicCode,
    publicVerifyCode: input.publicVerifyCode,
    contentHash: input.contentHash,
    networkName: input.networkName,
    transactionHash: input.transactionHash,
    blockNumber: input.blockNumber,
    issuedAt,
    expiresAt,
    signatureVersion: QrIntegrity.signatureVersion,
    algorithm: QrIntegrity.algorithm,
  };
  const signature = signQrPayloadBody(unsigned);
  const payloadHash = computePayloadHash(canonicalJson(unsigned));
  const payload: QrPayloadV3 = {
    ...unsigned,
    signature,
    payloadHash,
  };
  const wire = canonicalJson(payload);
  return { payload, wire, integrity: buildIntegrityMeta(wire, payload) };
}

export function wireStringForPayload(payload: QrPayload): string {
  if (payload.formatVersion === "V1") return payload.url;
  return canonicalJson(payload);
}

export function evaluateQrStatus(qr: {
  status: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  disabledAt: Date | null;
}): string {
  if (qr.revokedAt || qr.status === "revoked") return "revoked";
  if (qr.disabledAt || qr.status === "disabled") return "disabled";
  if (qr.status === "rotated") return "rotated";
  if (qr.expiresAt && qr.expiresAt <= new Date()) return "expired";
  if (qr.status === "expired") return "expired";
  return "active";
}
