import assert from "node:assert/strict";
import {
  computeReportChecksum,
  generatePublicCode,
  signPublicReport,
  verifyReportSignature,
} from "../utils/crypto.js";
import { evaluateLinkStatus, isPubliclyVerifiableVisibility } from "../utils/abuse.js";
import { PublicVerificationLinkStatuses, VerificationVisibility } from "@trustchain/config";

export function testPublicCodes() {
  assert.match(generatePublicCode("PUB-VERIFY"), /^PUB-VERIFY-[0-9A-F]{8}$/);
  assert.match(generatePublicCode("PUB-LINK"), /^PUB-LINK-[0-9A-F]{8}$/);
}

export function testReportSigning() {
  process.env.PUBLIC_VERIFY_SIGNING_SECRET = "test-secret-for-wave5";
  const payload = { verificationResult: "valid", contentHash: "a".repeat(64) };
  const signed = signPublicReport(payload);
  assert.ok(signed.reportSignature);
  assert.equal(signed.reportChecksum, computeReportChecksum(payload));
  assert.ok(verifyReportSignature({ payload, ...signed }));

  assert.equal(
    verifyReportSignature({
      payload: { ...payload, tampered: true },
      ...signed,
    }),
    false,
  );
}

export function testVisibilityAndLinkState() {
  assert.equal(isPubliclyVerifiableVisibility(VerificationVisibility.public), true);
  assert.equal(isPubliclyVerifiableVisibility(VerificationVisibility.restricted), true);
  assert.equal(isPubliclyVerifiableVisibility(VerificationVisibility.private), false);

  assert.equal(
    evaluateLinkStatus({
      status: "active",
      expiresAt: null,
      revokedAt: new Date(),
      disabledAt: null,
    }),
    PublicVerificationLinkStatuses.revoked,
  );
  assert.equal(
    evaluateLinkStatus({
      status: "active",
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      disabledAt: null,
    }),
    PublicVerificationLinkStatuses.expired,
  );
}
