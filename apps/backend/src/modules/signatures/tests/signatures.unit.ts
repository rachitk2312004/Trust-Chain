import assert from "node:assert/strict";
import {
  SignatureAlgorithms,
  SignatureEventTypes,
  SignatureStatuses,
} from "@trustchain/config";
import { AppError } from "../../../lib/errors.js";
import {
  assertSupportedAlgorithm,
  buildCanonicalPayload,
  canonicalizeSignaturePayload,
  generateKeyPairForAlgorithm,
  generateSignaturePublicId,
  hashCanonicalPayload,
  hashSignatureIntegrity,
  isSupportedSignatureAlgorithm,
  signCanonicalPayload,
  verifyCanonicalPayload,
} from "../signatures.validator.js";
import { resolveEffectiveStatus, verifySignatureRecord } from "../signatures.verifier.js";

function signFixture(algorithm: (typeof SignatureAlgorithms)[keyof typeof SignatureAlgorithms]) {
  const alg = assertSupportedAlgorithm(algorithm);
  const pair = generateKeyPairForAlgorithm(alg);
  const signedAt = new Date("2026-08-03T12:00:00.000Z");
  const payload = buildCanonicalPayload({
    organizationId: "11111111-1111-1111-1111-111111111111",
    signerId: "22222222-2222-2222-2222-222222222222",
    documentId: "33333333-3333-3333-3333-333333333333",
    certificateId: null,
    timestamp: signedAt,
    algorithm: alg,
    metadata: { purpose: "phase-d" },
    contentHash: "a".repeat(64),
  });
  const canonical = canonicalizeSignaturePayload(payload);
  const payloadHash = hashCanonicalPayload(canonical);
  const signatureValue = signCanonicalPayload(alg, canonical, pair.privateKeyPem);
  const publicId = generateSignaturePublicId();
  const integrityHash = hashSignatureIntegrity({
    publicId,
    organizationId: payload.organizationId,
    signerId: payload.signerId,
    documentId: payload.documentId,
    certificateId: payload.certificateId,
    algorithm: alg,
    publicKeyPem: pair.publicKeyPem,
    signatureValue,
    payloadHash,
    signedAt: signedAt.toISOString(),
    expiresAt: null,
    metadata: payload.metadata,
  });

  return {
    alg,
    pair,
    signedAt,
    payload,
    canonical,
    payloadHash,
    signatureValue,
    publicId,
    integrityHash,
  };
}

export function testSignatureCreation(): void {
  const rsa = signFixture(SignatureAlgorithms.rsaSha256);
  assert.match(rsa.publicId, /^SIG-/);
  assert.equal(rsa.payloadHash.length, 64);
  assert.equal(rsa.integrityHash.length, 64);
  assert.ok(rsa.signatureValue.length > 20);
  assert.ok(rsa.pair.publicKeyPem.includes("BEGIN PUBLIC KEY"));
  assert.ok(rsa.pair.privateKeyPem.includes("BEGIN PRIVATE KEY"));

  const ecdsa = signFixture(SignatureAlgorithms.ecdsaP256Sha256);
  assert.match(ecdsa.publicId, /^SIG-/);
  assert.equal(ecdsa.alg, SignatureAlgorithms.ecdsaP256Sha256);
}

export function testSignatureVerification(): void {
  const fx = signFixture(SignatureAlgorithms.rsaSha256);
  const ok = verifySignatureRecord({
    publicId: fx.publicId,
    organizationId: fx.payload.organizationId,
    signerId: fx.payload.signerId,
    documentId: fx.payload.documentId,
    certificateId: fx.payload.certificateId,
    algorithm: fx.alg,
    publicKeyPem: fx.pair.publicKeyPem,
    signatureValue: fx.signatureValue,
    payloadHash: fx.payloadHash,
    integrityHash: fx.integrityHash,
    signedAt: fx.signedAt,
    expiresAt: null,
    metadata: fx.payload.metadata,
    status: SignatureStatuses.active,
    contentHash: fx.payload.contentHash,
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.checks.cryptographic, true);
  assert.equal(ok.checks.integrity, true);

  const bad = verifySignatureRecord({
    publicId: fx.publicId,
    organizationId: fx.payload.organizationId,
    signerId: fx.payload.signerId,
    documentId: fx.payload.documentId,
    certificateId: fx.payload.certificateId,
    algorithm: fx.alg,
    publicKeyPem: fx.pair.publicKeyPem,
    signatureValue: fx.signatureValue,
    payloadHash: fx.payloadHash,
    integrityHash: fx.integrityHash,
    signedAt: fx.signedAt,
    expiresAt: null,
    metadata: { purpose: "tampered" },
    status: SignatureStatuses.active,
    contentHash: fx.payload.contentHash,
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.reasons.includes("PAYLOAD_HASH_MISMATCH") || bad.reasons.includes("INTEGRITY_MISMATCH"));
}

export function testSignatureRevocation(): void {
  const fx = signFixture(SignatureAlgorithms.ecdsaP256Sha256);
  const revoked = verifySignatureRecord({
    publicId: fx.publicId,
    organizationId: fx.payload.organizationId,
    signerId: fx.payload.signerId,
    documentId: fx.payload.documentId,
    certificateId: fx.payload.certificateId,
    algorithm: fx.alg,
    publicKeyPem: fx.pair.publicKeyPem,
    signatureValue: fx.signatureValue,
    payloadHash: fx.payloadHash,
    integrityHash: fx.integrityHash,
    signedAt: fx.signedAt,
    expiresAt: null,
    metadata: fx.payload.metadata,
    status: SignatureStatuses.revoked,
    contentHash: fx.payload.contentHash,
  });
  assert.equal(revoked.valid, false);
  assert.equal(revoked.checks.notRevoked, false);
  assert.ok(revoked.reasons.includes("SIGNATURE_REVOKED"));
  assert.equal(resolveEffectiveStatus(SignatureStatuses.revoked, null), SignatureStatuses.revoked);
}

export function testSignatureHistoryShape(): void {
  const created = {
    eventType: SignatureEventTypes.created,
    payload: { publicId: "SIG-1", algorithm: SignatureAlgorithms.rsaSha256 },
  };
  const verified = {
    eventType: SignatureEventTypes.verified,
    payload: { valid: true, reasons: [] as string[] },
  };
  const revoked = {
    eventType: SignatureEventTypes.revoked,
    payload: { reason: "compromised key" },
  };
  assert.equal(created.eventType, "created");
  assert.equal(verified.eventType, "verified");
  assert.equal(revoked.eventType, "revoked");
  assert.equal(typeof created.payload.publicId, "string");
}

export function testAlgorithmSelection(): void {
  assert.equal(isSupportedSignatureAlgorithm(SignatureAlgorithms.rsaSha256), true);
  assert.equal(isSupportedSignatureAlgorithm(SignatureAlgorithms.ecdsaP256Sha256), true);
  assert.equal(isSupportedSignatureAlgorithm(SignatureAlgorithms.ed25519), false);

  assert.throws(
    () => assertSupportedAlgorithm(SignatureAlgorithms.ed25519),
    (error) => error instanceof AppError && error.code === "ALGORITHM_NOT_IMPLEMENTED",
  );
  assert.throws(
    () => assertSupportedAlgorithm("HMAC-SHA256"),
    (error) => error instanceof AppError && error.code === "UNSUPPORTED_ALGORITHM",
  );

  const rsa = generateKeyPairForAlgorithm(SignatureAlgorithms.rsaSha256);
  const ecdsa = generateKeyPairForAlgorithm(SignatureAlgorithms.ecdsaP256Sha256);
  const message = canonicalizeSignaturePayload(
    buildCanonicalPayload({
      organizationId: "o",
      signerId: "s",
      timestamp: new Date("2026-08-03T00:00:00.000Z"),
      algorithm: SignatureAlgorithms.rsaSha256,
      metadata: {},
    }),
  );
  const rsaSig = signCanonicalPayload(SignatureAlgorithms.rsaSha256, message, rsa.privateKeyPem);
  assert.equal(
    verifyCanonicalPayload(SignatureAlgorithms.rsaSha256, message, rsa.publicKeyPem, rsaSig),
    true,
  );
  assert.equal(
    verifyCanonicalPayload(SignatureAlgorithms.ecdsaP256Sha256, message, ecdsa.publicKeyPem, rsaSig),
    false,
  );
}
