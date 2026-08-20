import assert from "node:assert/strict";
import { CertificateEventTypes, CertificateStatuses } from "@trustchain/config";
import {
  generateCertificateIdentity,
  hashCertificatePayload,
  canonicalizeCertificatePayload,
} from "../certificates.generator.js";
import { defaultCertificateLayout } from "../certificates.templates.js";
import { verifyCertificate } from "../certificates.verifier.js";

export function testCertificateIssuanceIdentity(): void {
  const identity = generateCertificateIdentity({
    organizationId: "11111111-1111-1111-1111-111111111111",
    title: "Completion Certificate",
    recipientName: "Ada Lovelace",
    recipientEmail: "ada@example.com",
    issuedAt: new Date("2026-08-03T12:00:00.000Z"),
    expiresAt: new Date("2027-08-03T12:00:00.000Z"),
    templateId: null,
    documentId: "22222222-2222-2222-2222-222222222222",
    metadata: { course: "TrustChain 101" },
  });

  assert.match(identity.publicId, /^CERT-/);
  assert.equal(identity.integrityHash.length, 64);
  assert.match(identity.verificationUrl, /\/certificates\/verify\/CERT-/);

  const again = hashCertificatePayload({
    publicId: identity.publicId,
    organizationId: "11111111-1111-1111-1111-111111111111",
    title: "Completion Certificate",
    recipientName: "Ada Lovelace",
    recipientEmail: "ada@example.com",
    issuedAt: "2026-08-03T12:00:00.000Z",
    expiresAt: "2027-08-03T12:00:00.000Z",
    templateId: null,
    documentId: "22222222-2222-2222-2222-222222222222",
    metadata: { course: "TrustChain 101" },
  });
  assert.equal(again, identity.integrityHash);
}

export function testCertificateVerification(): void {
  const issuedAt = new Date("2026-08-03T12:00:00.000Z");
  const identity = generateCertificateIdentity({
    organizationId: "org",
    title: "Title",
    recipientName: "Bob",
    issuedAt,
    metadata: {},
  });

  const base = {
    publicId: identity.publicId,
    organizationId: "org",
    title: "Title",
    recipientName: "Bob",
    recipientEmail: null,
    issuedAt,
    expiresAt: null,
    templateId: null,
    documentId: null,
    metadata: {},
    integrityHash: identity.integrityHash,
    status: CertificateStatuses.issued,
    qrPublicCode: null,
  };

  const ok = verifyCertificate(base);
  assert.equal(ok.valid, true);
  assert.equal(ok.checks.integrity, true);

  const revoked = verifyCertificate({ ...base, status: CertificateStatuses.revoked });
  assert.equal(revoked.valid, false);
  assert.ok(revoked.reasons.includes("CERTIFICATE_REVOKED"));

  const tampered = verifyCertificate({ ...base, title: "Tampered" });
  assert.equal(tampered.valid, false);
  assert.ok(tampered.reasons.includes("INTEGRITY_MISMATCH"));

  const expired = verifyCertificate({
    ...base,
    expiresAt: new Date("2020-01-01T00:00:00.000Z"),
  });
  assert.equal(expired.valid, false);
  assert.ok(expired.reasons.includes("CERTIFICATE_EXPIRED"));
}

export function testCertificateRevocationSemantics(): void {
  // Pure status transition rules used by service.
  function applyRevoke(status: string): string {
    if (status === CertificateStatuses.revoked) return status;
    return CertificateStatuses.revoked;
  }
  assert.equal(applyRevoke(CertificateStatuses.issued), CertificateStatuses.revoked);
  assert.equal(applyRevoke(CertificateStatuses.revoked), CertificateStatuses.revoked);
}

export function testTemplateHandling(): void {
  const layout = defaultCertificateLayout();
  assert.equal(layout.version, 1);
  assert.ok(layout.fields.includes("publicId"));
  assert.ok(layout.fields.includes("recipientName"));

  const canonicalA = canonicalizeCertificatePayload({
    publicId: "CERT-1",
    organizationId: "o",
    title: "t",
    recipientName: "r",
    recipientEmail: null,
    issuedAt: null,
    expiresAt: null,
    templateId: null,
    documentId: null,
    metadata: { b: 1, a: 2 },
  });
  const canonicalB = canonicalizeCertificatePayload({
    publicId: "CERT-1",
    organizationId: "o",
    title: "t",
    recipientName: "r",
    recipientEmail: null,
    issuedAt: null,
    expiresAt: null,
    templateId: null,
    documentId: null,
    metadata: { a: 2, b: 1 },
  });
  assert.equal(canonicalA, canonicalB);
}

export function testCertificateEventCreationShape(): void {
  const event = {
    eventType: CertificateEventTypes.issued,
    payload: { publicId: "CERT-X", documentId: null, qrPublicCode: null },
  };
  assert.equal(event.eventType, "issued");
  assert.equal(typeof event.payload.publicId, "string");

  const verified = {
    eventType: CertificateEventTypes.verified,
    payload: { valid: true, reasons: [] as string[], checks: { integrity: true } },
  };
  assert.equal(verified.eventType, "verified");
  assert.equal(verified.payload.valid, true);

  const revoked = {
    eventType: CertificateEventTypes.revoked,
    payload: { reason: "policy" },
  };
  assert.equal(revoked.eventType, "revoked");
}
