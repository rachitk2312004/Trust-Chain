import { createHash, createSign, createVerify, generateKeyPairSync, randomBytes } from "node:crypto";
import {
  SignatureAlgorithms,
  SupportedSignatureAlgorithms,
} from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export type SignatureAlgorithmId =
  (typeof SupportedSignatureAlgorithms)[number];

export type CanonicalSignaturePayload = {
  organizationId: string;
  signerId: string;
  documentId: string | null;
  certificateId: string | null;
  timestamp: string;
  algorithm: string;
  metadata: Record<string, unknown>;
  /** Optional pre-bound content hash (e.g. document content hash). */
  contentHash: string | null;
};

export type GeneratedKeyPair = {
  publicKeyPem: string;
  privateKeyPem: string;
};

export function isSupportedSignatureAlgorithm(value: string): value is SignatureAlgorithmId {
  return (SupportedSignatureAlgorithms as readonly string[]).includes(value);
}

export function assertSupportedAlgorithm(algorithm: string): SignatureAlgorithmId {
  if (!isSupportedSignatureAlgorithm(algorithm)) {
    if (algorithm === SignatureAlgorithms.ed25519) {
      throw new AppError(
        400,
        "ALGORITHM_NOT_IMPLEMENTED",
        "Ed25519 is reserved for a future release",
      );
    }
    throw new AppError(400, "UNSUPPORTED_ALGORITHM", `Unsupported algorithm: ${algorithm}`);
  }
  return algorithm;
}

export function generateSignaturePublicId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `SIG-${stamp}-${rand}`;
}

function sortKeys(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = value[key];
  }
  return out;
}

/** Stable JSON for hashing/signing. */
export function canonicalizeSignaturePayload(payload: CanonicalSignaturePayload): string {
  const ordered = {
    algorithm: payload.algorithm,
    certificateId: payload.certificateId,
    contentHash: payload.contentHash,
    documentId: payload.documentId,
    metadata: sortKeys(payload.metadata),
    organizationId: payload.organizationId,
    signerId: payload.signerId,
    timestamp: payload.timestamp,
  };
  return JSON.stringify(ordered);
}

export function hashCanonicalPayload(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function hashSignatureIntegrity(input: {
  publicId: string;
  organizationId: string;
  signerId: string;
  documentId: string | null;
  certificateId: string | null;
  algorithm: string;
  publicKeyPem: string;
  signatureValue: string;
  payloadHash: string;
  signedAt: string;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
}): string {
  const ordered = {
    algorithm: input.algorithm,
    certificateId: input.certificateId,
    documentId: input.documentId,
    expiresAt: input.expiresAt,
    metadata: sortKeys(input.metadata),
    organizationId: input.organizationId,
    payloadHash: input.payloadHash,
    publicId: input.publicId,
    publicKeyPem: input.publicKeyPem,
    signatureValue: input.signatureValue,
    signedAt: input.signedAt,
    signerId: input.signerId,
  };
  return createHash("sha256").update(JSON.stringify(ordered), "utf8").digest("hex");
}

export function generateKeyPairForAlgorithm(algorithm: SignatureAlgorithmId): GeneratedKeyPair {
  if (algorithm === SignatureAlgorithms.rsaSha256) {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { publicKeyPem: publicKey, privateKeyPem: privateKey };
  }

  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

function nodeSignAlgorithm(_algorithm: SignatureAlgorithmId): string {
  // Both RSA and ECDSA use SHA-256 digests via createSign.
  void _algorithm;
  return "SHA256";
}

export function signCanonicalPayload(
  algorithm: SignatureAlgorithmId,
  canonical: string,
  privateKeyPem: string,
): string {
  try {
    const signer = createSign(nodeSignAlgorithm(algorithm));
    signer.update(canonical, "utf8");
    signer.end();
    return signer.sign(privateKeyPem).toString("base64");
  } catch (error) {
    throw new AppError(
      400,
      "SIGNATURE_CREATE_FAILED",
      `Failed to create signature: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function verifyCanonicalPayload(
  algorithm: SignatureAlgorithmId,
  canonical: string,
  publicKeyPem: string,
  signatureValueBase64: string,
): boolean {
  try {
    const verifier = createVerify(nodeSignAlgorithm(algorithm));
    verifier.update(canonical, "utf8");
    verifier.end();
    return verifier.verify(publicKeyPem, Buffer.from(signatureValueBase64, "base64"));
  } catch {
    return false;
  }
}

export function buildCanonicalPayload(input: {
  organizationId: string;
  signerId: string;
  documentId?: string | null;
  certificateId?: string | null;
  timestamp: Date;
  algorithm: string;
  metadata?: Record<string, unknown>;
  contentHash?: string | null;
}): CanonicalSignaturePayload {
  return {
    organizationId: input.organizationId,
    signerId: input.signerId,
    documentId: input.documentId ?? null,
    certificateId: input.certificateId ?? null,
    timestamp: input.timestamp.toISOString(),
    algorithm: input.algorithm,
    metadata: input.metadata ?? {},
    contentHash: input.contentHash ?? null,
  };
}
