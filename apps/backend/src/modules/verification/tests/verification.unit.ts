import assert from "node:assert/strict";
import { resolveOutcome } from "../utils/outcome.js";
import { generateVerificationCode } from "../utils/verificationCode.js";
import { buildVerificationReport } from "../reports/reportGenerator.js";
import { VerificationInternalStatuses, VerificationOutcomes } from "@trustchain/config";
import { parseBulkLines, summarizeBulkResults, normalizeBulkIdentifier } from "../services/verification.bulk.js";
import {
  decideIntakeMatch,
  extractCertificatePublicId,
  extractCertificateUuid,
  collectIdsFromPdfHexStrings,
  extractClaimedNameFromFileName,
  extractPrintedNameFromPdfText,
} from "../services/verification.intake.js";
import { looksLikePersonName, namesMatch, identityMismatchMessage } from "../services/verification.names.js";

export function testVerificationCodeFormat() {
  const code = generateVerificationCode(new Date("2026-08-02T12:00:00Z"));
  assert.match(code, /^VERIFY-20260802-[0-9A-F]{8}$/);
}

export function testOutcomePrecedence() {
  const tampered = resolveOutcome([
    { name: "hash_matches", passed: false, code: "hash_tampered" },
    { name: "not_revoked", passed: false, code: "revoked" },
  ]);
  assert.equal(tampered.outcome, VerificationOutcomes.tampered);

  const revoked = resolveOutcome([{ name: "not_revoked", passed: false, code: "revoked" }]);
  assert.equal(revoked.outcome, VerificationOutcomes.revoked);

  const expired = resolveOutcome([
    { name: "document_not_expired", passed: false, code: "document_expired" },
  ]);
  assert.equal(expired.outcome, VerificationOutcomes.expired);

  const missing = resolveOutcome([
    { name: "version_present", passed: false, code: "version_missing" },
  ]);
  assert.equal(missing.outcome, VerificationOutcomes.missing);

  const valid = resolveOutcome([{ name: "hash_matches", passed: true }]);
  assert.equal(valid.outcome, VerificationOutcomes.valid);
}

export function testReportProofFields() {
  const report = buildVerificationReport({
    verificationId: "11111111-1111-1111-1111-111111111111",
    verificationCode: "VERIFY-20260802-ABCD1234",
    organizationId: "22222222-2222-2222-2222-222222222222",
    documentId: "33333333-3333-3333-3333-333333333333",
    versionNumber: 1,
    contentHash: "a".repeat(64),
    blockchainStatus: "anchored",
    revocationStatus: "not_revoked",
    status: VerificationInternalStatuses.completed,
    outcome: VerificationOutcomes.valid,
    failureReasons: [],
    checks: [],
    proofOfIntegrity: "a".repeat(64),
    proofTimestamp: new Date("2026-08-02T00:00:00Z"),
    networkName: "Hardhat",
    transactionHash: "0xabc",
    blockNumber: 12n,
  });

  assert.equal(report.proofOfIntegrity, "a".repeat(64));
  assert.equal(report.networkName, "Hardhat");
  assert.equal(report.transactionHash, "0xabc");
  assert.equal(report.blockNumber, 12);
  assert.equal(report.status, VerificationInternalStatuses.completed);
  assert.equal(report.verificationResult, VerificationOutcomes.valid);
  assert.ok(report.proofTimestamp);
}

export function testBulkVerifyHelpers() {
  assert.deepEqual(parseBulkLines("a\nb, c; ;d\n"), ["a", "b", "c", "d"]);
  assert.equal(
    normalizeBulkIdentifier("https://localhost:5173/certificates/verify/CERT-MTTBIU71-CEB87247"),
    "CERT-MTTBIU71-CEB87247",
  );
  assert.equal(normalizeBulkIdentifier("cert-mttbiu71-ceb87247"), "CERT-MTTBIU71-CEB87247");
  const summary = summarizeBulkResults([
    { label: "one", category: "documents", outcome: "valid", valid: true },
    { label: "two", category: "documents", outcome: "tampered", valid: false },
    { label: "three", category: "certificates", outcome: "valid", valid: true },
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.valid, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.byOutcome.valid, 2);
}

export function testIntakeFileMatching() {
  assert.equal(
    extractCertificatePublicId("certificate-CERT-MTTBIU71-CEB87247.pdf"),
    "CERT-MTTBIU71-CEB87247",
  );
  assert.equal(extractCertificatePublicId("random-resume.pdf"), null);

  const hash = "a".repeat(64);
  const named = {
    publicId: "CERT-MTTBIU71-CEB87247",
    status: "issued",
    storedHash: hash,
    title: "Attendance",
    recipientName: "Aditya",
  };

  const authentic = decideIntakeMatch({
    fileName: "certificate-CERT-MTTBIU71-CEB87247.pdf",
    contentHash: hash,
    claimedFromContent: false,
    namedCertificate: named,
    hashCertificate: named,
  });
  assert.equal(authentic.verdict, "authentic");
  assert.equal(authentic.valid, true);

  const fake = decideIntakeMatch({
    fileName: "random.pdf",
    contentHash: "b".repeat(64),
    claimedFromContent: false,
    namedCertificate: null,
    hashCertificate: null,
  });
  assert.equal(fake.verdict, "not_found");
  assert.equal(fake.valid, false);

  const stolenId = decideIntakeMatch({
    fileName: "certificate-CERT-MTTBIU71-CEB87247.pdf",
    contentHash: "b".repeat(64),
    claimedFromContent: false,
    namedCertificate: named,
    hashCertificate: null,
  });
  assert.equal(stolenId.verdict, "tampered");
  assert.equal(stolenId.outcome, "tampered");

  const rerenderedDownload = decideIntakeMatch({
    fileName: "aae5de55-3af7-4efb-9fa8-068ded368d6b (1).pdf",
    contentHash: "b".repeat(64),
    claimedFromContent: true,
    namedCertificate: named,
    hashCertificate: null,
  });
  assert.equal(rerenderedDownload.verdict, "authentic");
  assert.equal(namesMatch("Aditya", "aditya"), true);
  assert.equal(namesMatch("Ravi", "Aditya"), false);
  assert.match(identityMismatchMessage("Aditya", "Ravi"), /Submitted as Ravi/);
  assert.equal(extractClaimedNameFromFileName("Ravi.pdf"), "Ravi");
  assert.equal(extractClaimedNameFromFileName("CERT-MUN4BJTV-5E1922C6.pdf"), null);
  assert.equal(looksLikePersonName("trust-chain-blush-kappa.vercel.app"), false);
  assert.equal(looksLikePersonName("Aishwary Singh"), true);
  assert.equal(
    extractPrintedNameFromPdfText(
      "Employee Achievement Award\nScan to verify\nhttps://trust-chain-blush-kappa.vercel.app/certificates/verify/CERT-MUN4BJTV-5E1922C6\nAishwary Singh\nIssued TrustChain PDF",
      "Aishwary Singh",
    ),
    "Aishwary Singh",
  );
  assert.equal(
    extractPrintedNameFromPdfText(
      "verify at trust-chain-blush-kappa.vercel.app\nCERT-MUN4BJTV-5E1922C6",
      null,
    ),
    null,
  );

  const missingArtifact = decideIntakeMatch({
    fileName: "CERT-MTTBIU71-CEB87247.pdf",
    contentHash: "b".repeat(64),
    claimedFromContent: false,
    namedCertificate: { ...named, storedHash: null },
    hashCertificate: null,
  });
  assert.equal(missingArtifact.verdict, "authentic");

  const hexIds = collectIdsFromPdfHexStrings(
    "<434552542D4D545442495537312D4345423837323437>",
  );
  assert.equal([...hexIds][0], "CERT-MTTBIU71-CEB87247");
  assert.equal(
    extractCertificateUuid("aae5de55-3af7-4efb-9fa8-068ded368d6b (1).pdf"),
    "aae5de55-3af7-4efb-9fa8-068ded368d6b",
  );
}
