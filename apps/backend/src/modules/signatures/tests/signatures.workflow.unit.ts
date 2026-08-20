import assert from "node:assert/strict";
import {
  CertificateStatuses,
  DocumentStatuses,
  SignatureAlgorithms,
  SignatureArtifactKinds,
  SignatureStatuses,
  SignatureWorkflowKinds,
} from "@trustchain/config";
import { AppError } from "../../../lib/errors.js";
import {
  buildDetachedCanonical,
  normalizeDetachedPayload,
  pickDetachedArtifacts,
  verifyDetachedSignature,
} from "../signatures.detached.js";
import {
  applyExpirationStatus,
  assertSignatureNotExpired,
  assertSignatureNotRevoked,
  evaluateExpiration,
  isSignatureExpired,
  resolveExpiresAt,
  shouldPersistExpiredStatus,
} from "../signatures.expiration.js";
import {
  assertAlgorithmPolicy,
  assertCertificateSignable,
  assertDocumentSignable,
  assertExpirationPolicy,
  assertRevocationPolicy,
  assertWorkflowKindAllowed,
  defaultOrgSignaturePolicy,
  validateSignPolicy,
} from "../signatures.policy.js";
import {
  generateKeyPairForAlgorithm,
  signCanonicalPayload,
} from "../signatures.validator.js";
import { SIGNING_WORKFLOW_STEPS } from "../signatures.workflow.js";

export function testDocumentSigningPolicy(): void {
  const policy = defaultOrgSignaturePolicy();
  assertDocumentSignable(DocumentStatuses.active, policy);
  assertDocumentSignable(DocumentStatuses.draft, policy);
  assert.throws(
    () => assertDocumentSignable(DocumentStatuses.archived, policy),
    (error) => error instanceof AppError && error.code === "DOCUMENT_NOT_SIGNABLE",
  );
  assert.throws(
    () => assertDocumentSignable(DocumentStatuses.expired, policy),
    (error) => error instanceof AppError && error.code === "DOCUMENT_NOT_SIGNABLE",
  );

  assertWorkflowKindAllowed(SignatureWorkflowKinds.document, policy);
  assert.throws(
    () =>
      assertWorkflowKindAllowed(
        SignatureWorkflowKinds.document,
        defaultOrgSignaturePolicy({ allowDocumentSigning: false }),
      ),
    (error) => error instanceof AppError && error.code === "WORKFLOW_POLICY_DENIED",
  );

  assert.deepEqual(SIGNING_WORKFLOW_STEPS[0], "retrieve_target");
  assert.deepEqual(SIGNING_WORKFLOW_STEPS[SIGNING_WORKFLOW_STEPS.length - 1], "publish_events");
}

export function testCertificateSigningPolicy(): void {
  const policy = defaultOrgSignaturePolicy();
  assertCertificateSignable(CertificateStatuses.issued, policy);
  assert.throws(
    () => assertCertificateSignable(CertificateStatuses.revoked, policy),
    (error) => error instanceof AppError && error.code === "CERTIFICATE_NOT_SIGNABLE",
  );
  assert.throws(
    () => assertCertificateSignable(CertificateStatuses.expired, policy),
    (error) => error instanceof AppError && error.code === "CERTIFICATE_NOT_SIGNABLE",
  );
  assert.throws(
    () =>
      assertWorkflowKindAllowed(
        SignatureWorkflowKinds.certificate,
        defaultOrgSignaturePolicy({ allowCertificateSigning: false }),
      ),
    (error) => error instanceof AppError && error.code === "WORKFLOW_POLICY_DENIED",
  );
}

export function testDetachedSignatures(): void {
  const orgId = "11111111-1111-1111-1111-111111111111";
  const signerId = "22222222-2222-2222-2222-222222222222";
  const algorithm = SignatureAlgorithms.ecdsaP256Sha256;
  const pair = generateKeyPairForAlgorithm(algorithm);
  const signedAt = new Date("2026-08-03T15:00:00.000Z");
  const raw = normalizeDetachedPayload({ hello: "trustchain", step: 2 });
  assert.equal(raw.contentType, "application/json");
  assert.equal(raw.contentHash.length, 64);

  const metadata = { purpose: "detached-test", workflow: "detached" };
  const { canonical } = buildDetachedCanonical({
    organizationId: orgId,
    signerId,
    timestamp: signedAt,
    algorithm,
    metadata,
    contentHash: raw.contentHash,
  });
  const signatureValue = signCanonicalPayload(algorithm, canonical, pair.privateKeyPem);

  const ok = verifyDetachedSignature({
    organizationId: orgId,
    signerId,
    algorithm,
    publicKeyPem: pair.publicKeyPem,
    signatureValue,
    signedAt,
    metadata,
    payload: { hello: "trustchain", step: 2 },
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.detached, true);
  assert.equal(ok.checks.cryptographic, true);

  const bad = verifyDetachedSignature({
    organizationId: orgId,
    signerId,
    algorithm,
    publicKeyPem: pair.publicKeyPem,
    signatureValue,
    signedAt,
    metadata,
    payload: { hello: "tampered", step: 2 },
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.reasons.includes("CRYPTOGRAPHIC_VERIFICATION_FAILED"));

  const artifacts = pickDetachedArtifacts([
    {
      kind: SignatureArtifactKinds.detachedPayload,
      content: raw.content,
      contentType: raw.contentType,
    },
    {
      kind: SignatureArtifactKinds.detachedSignature,
      content: signatureValue,
      contentType: "application/octet-stream",
    },
    {
      kind: SignatureArtifactKinds.publicKey,
      content: pair.publicKeyPem,
      contentType: "application/x-pem-file",
    },
  ]);
  assert.ok(artifacts.payload);
  assert.ok(artifacts.signature);
  assert.ok(artifacts.publicKey);

  assert.throws(
    () => normalizeDetachedPayload(""),
    (error) => error instanceof AppError && error.code === "INVALID_DETACHED_PAYLOAD",
  );
}

export function testExpirationHandling(): void {
  const now = new Date("2026-08-03T12:00:00.000Z");
  const past = new Date("2026-01-01T00:00:00.000Z");
  const future = new Date("2027-08-03T12:00:00.000Z");

  assert.equal(isSignatureExpired(past, now), true);
  assert.equal(isSignatureExpired(future, now), false);
  assert.equal(isSignatureExpired(null, now), false);

  assert.equal(
    applyExpirationStatus(SignatureStatuses.active, past, now),
    SignatureStatuses.expired,
  );
  assert.equal(
    applyExpirationStatus(SignatureStatuses.revoked, past, now),
    SignatureStatuses.revoked,
  );
  assert.equal(shouldPersistExpiredStatus(SignatureStatuses.active, past, now), true);
  assert.equal(shouldPersistExpiredStatus(SignatureStatuses.revoked, past, now), false);

  const evalResult = evaluateExpiration(SignatureStatuses.active, future, now);
  assert.equal(evalResult.expired, false);
  assert.ok(evalResult.remainingMs != null && evalResult.remainingMs > 0);

  assert.throws(
    () => assertSignatureNotExpired(SignatureStatuses.active, past, now),
    (error) => error instanceof AppError && error.code === "SIGNATURE_EXPIRED",
  );

  const policy = defaultOrgSignaturePolicy({ defaultExpirationDays: 30, maxExpirationDays: 90 });
  const resolved = resolveExpiresAt({ signedAt: now, policy });
  assert.ok(resolved);
  assert.equal(resolved!.getTime(), now.getTime() + 30 * 24 * 60 * 60 * 1000);

  assert.throws(
    () => assertExpirationPolicy(new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000), policy, now),
    (error) => error instanceof AppError && error.code === "EXPIRATION_TOO_FAR",
  );

  assert.throws(
    () =>
      assertExpirationPolicy(null, defaultOrgSignaturePolicy({ requireExpiration: true }), now),
    (error) => error instanceof AppError && error.code === "EXPIRATION_REQUIRED",
  );
}

export function testRevocationHandling(): void {
  assert.throws(
    () => assertSignatureNotRevoked(SignatureStatuses.revoked),
    (error) => error instanceof AppError && error.code === "SIGNATURE_REVOKED",
  );
  assertSignatureNotRevoked(SignatureStatuses.active);

  assertRevocationPolicy({
    isSigner: true,
    isAdmin: false,
    policy: defaultOrgSignaturePolicy(),
  });
  assertRevocationPolicy({
    isSigner: false,
    isAdmin: true,
    policy: defaultOrgSignaturePolicy(),
  });
  assert.throws(
    () =>
      assertRevocationPolicy({
        isSigner: true,
        isAdmin: false,
        policy: defaultOrgSignaturePolicy({ allowRevokeBySigner: false }),
      }),
    (error) => error instanceof AppError && error.code === "REVOKE_POLICY_DENIED",
  );
  assert.throws(
    () =>
      assertRevocationPolicy({
        isSigner: false,
        isAdmin: false,
        policy: defaultOrgSignaturePolicy(),
      }),
    (error) => error instanceof AppError && error.code === "REVOKE_POLICY_DENIED",
  );

  const expiredDetached = verifyDetachedSignature({
    organizationId: "11111111-1111-1111-1111-111111111111",
    signerId: "22222222-2222-2222-2222-222222222222",
    algorithm: SignatureAlgorithms.rsaSha256,
    publicKeyPem: generateKeyPairForAlgorithm(SignatureAlgorithms.rsaSha256).publicKeyPem,
    signatureValue: Buffer.from("deadbeef").toString("base64"),
    signedAt: "2025-01-01T00:00:00.000Z",
    expiresAt: "2025-06-01T00:00:00.000Z",
    payload: "payload",
    status: SignatureStatuses.revoked,
  });
  assert.equal(expiredDetached.valid, false);
  assert.ok(expiredDetached.reasons.includes("SIGNATURE_REVOKED"));
}

export function testPolicyValidation(): void {
  const policy = defaultOrgSignaturePolicy();
  const ok = validateSignPolicy({
    kind: SignatureWorkflowKinds.detached,
    algorithm: SignatureAlgorithms.rsaSha256,
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    signedAt: new Date("2026-08-03T00:00:00.000Z"),
    policy,
  });
  assert.equal(ok.algorithm, SignatureAlgorithms.rsaSha256);

  assert.throws(
    () => assertAlgorithmPolicy(SignatureAlgorithms.ed25519, policy),
    (error) => error instanceof AppError && error.code === "ALGORITHM_NOT_IMPLEMENTED",
  );
  assert.throws(
    () =>
      assertAlgorithmPolicy(
        SignatureAlgorithms.ecdsaP256Sha256,
        defaultOrgSignaturePolicy({
          allowedAlgorithms: [SignatureAlgorithms.rsaSha256],
        }),
      ),
    (error) => error instanceof AppError && error.code === "ALGORITHM_POLICY_DENIED",
  );
  assert.throws(
    () =>
      assertWorkflowKindAllowed(
        SignatureWorkflowKinds.detached,
        defaultOrgSignaturePolicy({ allowDetached: false }),
      ),
    (error) => error instanceof AppError && error.code === "WORKFLOW_POLICY_DENIED",
  );
}
