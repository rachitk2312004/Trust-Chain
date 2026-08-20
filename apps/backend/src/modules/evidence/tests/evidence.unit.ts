import assert from "node:assert/strict";
import { EvidenceCustodyActions } from "@trustchain/config";
import {
  exportEvidenceToCsv,
  exportEvidenceToJson,
  generateEvidenceExport,
} from "../evidence.export.js";
import {
  assertValidLinkTarget,
  buildCustodyIntegrityHash,
  computeContentChecksum,
  extractEvidenceMetadata,
  nextVersionNumber,
  normalizeFrameworks,
  normalizeTags,
  validateEvidenceRecord,
  verifyCustodyChain,
} from "../evidence.validation.js";
import { AppError } from "../../../lib/errors.js";

export function testValidation(): void {
  const content = "SOC2 access review evidence 2026";
  const checksum = computeContentChecksum(content);
  assert.equal(checksum.length, 64);

  const ok = validateEvidenceRecord({
    checksumSha256: checksum,
    contentText: content,
    frameworks: ["soc2"],
    tags: ["access-review"],
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.checksumOk, true);

  const bad = validateEvidenceRecord({
    checksumSha256: checksum,
    contentText: content + " tampered",
    frameworks: ["soc2"],
  });
  assert.equal(bad.valid, false);
  assert.equal(bad.checksumOk, false);

  const meta = extractEvidenceMetadata({
    fileName: "review.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1200,
    tags: [" SOC2 ", "soc2", "Access"],
    frameworks: ["soc2", "unknown", "gdpr"],
  });
  assert.equal(meta.inferredKind, "pdf");
  assert.deepEqual(meta.tags, ["soc2", "access"]);
  assert.deepEqual(normalizeFrameworks(["soc2", "hipaa"]), ["soc2", "hipaa"]);
  assert.deepEqual(normalizeTags(["A", "a", "B"]), ["a", "b"]);
}

export function testVersioning(): void {
  assert.equal(nextVersionNumber(1), 2);
  assert.equal(nextVersionNumber(0), 2);
  assert.equal(nextVersionNumber(5), 6);

  const v1 = { version: 1, checksum: computeContentChecksum("v1") };
  const v2 = { version: nextVersionNumber(v1.version), checksum: computeContentChecksum("v2") };
  assert.notEqual(v1.checksum, v2.checksum);
  assert.equal(v2.version, 2);
}

export function testLinking(): void {
  assert.doesNotThrow(() => assertValidLinkTarget("assessment", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
  assert.throws(
    () => assertValidLinkTarget("unknown", "x"),
    (err: unknown) => err instanceof AppError && err.code === "VALIDATION_ERROR",
  );
  assert.throws(
    () => assertValidLinkTarget("document", "   "),
    (err: unknown) => err instanceof AppError,
  );
}

export function testExportGeneration(): void {
  const rows = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      publicCode: "EVD-TEST001",
      title: "Access review",
      status: "validated",
      currentVersion: 1,
      checksumSha256: computeContentChecksum("x"),
      frameworks: ["soc2"],
      tags: ["access"],
      mimeType: "text/plain",
      fileName: "review.txt",
      sizeBytes: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
      links: [{ targetType: "control", targetId: "CC6.1", label: null }],
      custody: [
        {
          action: EvidenceCustodyActions.collected,
          integrityHash: "abc",
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    },
  ];
  const json = exportEvidenceToJson(rows);
  assert.ok(json.includes("EVD-TEST001"));
  const csv = exportEvidenceToCsv(rows);
  assert.ok(csv.includes("publicCode"));
  const generated = generateEvidenceExport(rows, "csv");
  assert.equal(generated.rowCount, 1);
  assert.equal(generated.contentType, "text/csv");
}

export function testChainOfCustodyTracking(): void {
  const evidenceId = "22222222-2222-2222-2222-222222222222";
  const t1 = "2026-08-01T10:00:00.000Z";
  const h1 = buildCustodyIntegrityHash({
    evidenceId,
    action: EvidenceCustodyActions.collected,
    actorUserId: "u1",
    previousHash: null,
    createdAt: t1,
    details: { version: 1 },
  });
  const t2 = "2026-08-01T10:05:00.000Z";
  const h2 = buildCustodyIntegrityHash({
    evidenceId,
    action: EvidenceCustodyActions.validated,
    actorUserId: "u1",
    previousHash: h1,
    createdAt: t2,
    details: { valid: true },
  });
  const t3 = "2026-08-01T10:10:00.000Z";
  const h3 = buildCustodyIntegrityHash({
    evidenceId,
    action: EvidenceCustodyActions.linked,
    actorUserId: "u1",
    previousHash: h2,
    createdAt: t3,
    details: { targetType: "assessment" },
  });

  const chain = [
    { previousHash: null, integrityHash: h1 },
    { previousHash: h1, integrityHash: h2 },
    { previousHash: h2, integrityHash: h3 },
  ];
  assert.equal(verifyCustodyChain(chain), true);
  assert.equal(
    verifyCustodyChain([
      { previousHash: null, integrityHash: h1 },
      { previousHash: "deadbeef", integrityHash: h2 },
    ]),
    false,
  );
}
