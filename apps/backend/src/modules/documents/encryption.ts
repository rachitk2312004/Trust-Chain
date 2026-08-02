import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { DocumentEncryption } from "@trustchain/config";
import { streamEncryptObjectToKey } from "../../integrations/objectStorage.js";

export type EnvelopeEncryptionResult = {
  objectKey: string;
  encrypted: true;
  encryptionAlgorithm: string;
  keyVersion: number;
  wrappedDek: string;
  iv: string;
  authTag: string;
  encryptionMetadata: {
    kekVersion: number;
    wrappedAt: string;
  };
};

export type LegacyPassthroughResult = {
  objectKey: string;
  encrypted: false;
};

function resolveKeyMaterial(version: number): Buffer {
  const envName = `${DocumentEncryption.envKeyPrefix}${version}`;
  const raw = process.env[envName];
  if (!raw) {
    throw new Error(`${envName} is required when document encryption is enabled`);
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return createHash("sha256").update(raw).digest();
}

export function getActiveKeyVersion(): number {
  const raw = process.env.DOCUMENT_ACTIVE_KEY_VERSION ?? "1";
  const version = Number.parseInt(raw, 10);
  if (![1, 2, 3].includes(version)) {
    throw new Error("DOCUMENT_ACTIVE_KEY_VERSION must be 1, 2, or 3");
  }
  return version;
}

export function isDocumentEncryptionEnabled(): boolean {
  const flag = process.env.DOCUMENT_ENCRYPTION_ENABLED;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  // Default: enable when active key material is present
  try {
    const v = getActiveKeyVersion();
    return Boolean(process.env[`${DocumentEncryption.envKeyPrefix}${v}`]);
  } catch {
    return false;
  }
}

function wrapDek(dek: Buffer, kek: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kek, iv);
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function unwrapDek(wrappedDek: string, keyVersion: number): Buffer {
  const kek = resolveKeyMaterial(keyVersion);
  const [ivPart, tagPart, dataPart] = wrappedDek.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Invalid wrapped DEK payload");
  }
  const decipher = createDecipheriv("aes-256-gcm", kek, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
}

/**
 * Envelope-encrypt an uploaded plaintext object into a new ciphertext object key.
 * Legacy passthrough when encryption is disabled (existing plaintext remains readable).
 */
export async function encryptDocumentObject(input: {
  objectKey: string;
  mimeType: string;
  contentHash: string;
}): Promise<EnvelopeEncryptionResult | LegacyPassthroughResult> {
  if (!isDocumentEncryptionEnabled()) {
    return { objectKey: input.objectKey, encrypted: false };
  }

  const keyVersion = getActiveKeyVersion();
  const kek = resolveKeyMaterial(keyVersion);
  const dek = randomBytes(32);
  const destKey = `${input.objectKey}.enc`;

  const { iv, authTag } = await streamEncryptObjectToKey({
    sourceKey: input.objectKey,
    destKey,
    contentType: input.mimeType,
    dek,
  });

  return {
    objectKey: destKey,
    encrypted: true,
    encryptionAlgorithm: DocumentEncryption.algorithm,
    keyVersion,
    wrappedDek: wrapDek(dek, kek),
    iv,
    authTag,
    encryptionMetadata: {
      kekVersion: keyVersion,
      wrappedAt: new Date().toISOString(),
    },
  };
}

/** Unit-test helper: wrap/unwrap round-trip without R2. */
export function wrapUnwrapRoundTripForTests(plaintextDek?: Buffer): {
  keyVersion: number;
  wrappedDek: string;
  dek: Buffer;
} {
  const keyVersion = getActiveKeyVersion();
  const kek = resolveKeyMaterial(keyVersion);
  const dek = plaintextDek ?? randomBytes(32);
  const wrappedDek = wrapDek(dek, kek);
  const unwrapped = unwrapDek(wrappedDek, keyVersion);
  if (!unwrapped.equals(dek)) {
    throw new Error("DEK wrap/unwrap mismatch");
  }
  return { keyVersion, wrappedDek, dek };
}
