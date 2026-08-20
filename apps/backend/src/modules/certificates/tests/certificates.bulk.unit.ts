import assert from "node:assert/strict";
import {
  parseBulkCsv,
  parseBulkJson,
  parseFlexibleDate,
  splitCsvLine,
  validateBulkRows,
  type BulkImportRow,
} from "../certificates.import.js";
import {
  computeBulkPercent,
  isBulkCancelRequested,
  isTerminalBulkStatus,
  requestBulkCancel,
  clearBulkCancel,
  resolveTerminalStatus,
} from "../certificates.progress.js";

export function testCsvParsing(): void {
  const csv = [
    "recipient_name,recipient_email,certificate_identifier,issue_date,expiration_date,template_identifier,title,metadata",
    'Ada Lovelace,ada@example.com,CERT-ADA-1,2026-01-15,2027-01-15,completion-v1,Completion,"{""cohort"":""A""}"',
    "Grace Hopper,grace@example.com,,,completion-v1,Award,",
  ].join("\n");

  const rows = parseBulkCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.recipientName, "Ada Lovelace");
  assert.equal(rows[0]!.recipientEmail, "ada@example.com");
  assert.equal(rows[0]!.certificateIdentifier, "CERT-ADA-1");
  assert.equal(rows[0]!.metadata.cohort, "A");
  assert.equal(rows[1]!.recipientName, "Grace Hopper");

  const cells = splitCsvLine('a,"b,c",d');
  assert.deepEqual(cells, ["a", "b,c", "d"]);
}

export function testJsonParsingAndValidation(): void {
  const json = JSON.stringify([
    {
      recipientName: "Ada",
      recipientEmail: "not-an-email",
      certificateIdentifier: "CERT-1",
      issueDate: "2026-02-01",
      expirationDate: "2025-01-01",
      templateIdentifier: "missing-tpl",
      metadata: "{bad",
    },
    {
      recipient_name: "Ada",
      recipient_email: "ada@example.com",
      certificate_identifier: "CERT-1",
      template_identifier: "active-tpl",
    },
    {
      recipientName: "Valid Person",
      recipientEmail: "valid@example.com",
      templateIdentifier: "active-tpl",
      metadata: { level: 1 },
    },
  ]);

  const rows = parseBulkJson(json);
  assert.equal(rows.length, 3);

  const templatesByKey = new Map([
    ["active-tpl", { id: "tpl-uuid", code: "active-tpl", status: "active" }],
    ["archived-tpl", { id: "tpl-arch", code: "archived-tpl", status: "archived" }],
  ]);

  const preview = validateBulkRows(rows, { templatesByKey });
  assert.equal(preview.summary.totalRows, 3);
  assert.ok(preview.summary.invalidEmailCount >= 1);
  assert.ok(preview.summary.invalidDateCount >= 1);
  assert.ok(preview.summary.missingTemplateCount >= 1);
  assert.ok(preview.summary.malformedMetadataCount >= 1);
  assert.ok(preview.summary.duplicateCount >= 1);
  assert.equal(preview.rows[2]!.errors.length, 0);
  assert.equal(preview.rows[2]!.resolvedTemplateId, "tpl-uuid");

  const revoked = validateBulkRows(
    [
      {
        rowNumber: 1,
        recipientName: "X",
        recipientEmail: null,
        certificateIdentifier: null,
        issueDate: null,
        expirationDate: null,
        templateIdentifier: "archived-tpl",
        title: null,
        metadata: {},
      } satisfies BulkImportRow,
    ],
    { templatesByKey },
  );
  assert.equal(revoked.summary.revokedTemplateCount, 1);
  assert.ok(parseFlexibleDate("2026-08-03"));
  assert.equal(parseFlexibleDate("not-a-date"), null);
}

export function testBulkIssuancePlanShape(): void {
  const rows = parseBulkCsv(
    ["recipient_name,title", "Ada Lovelace,Completion", "Grace Hopper,Award"].join("\n"),
  );
  const preview = validateBulkRows(rows, { templatesByKey: new Map() });
  assert.equal(preview.summary.validRows, 2);
  assert.equal(preview.valid, true);
  // Issuance consumes only error-free rows.
  const issuable = preview.rows.filter((row) => row.errors.length === 0);
  assert.equal(issuable.length, 2);
  assert.equal(issuable[0]!.recipientName, "Ada Lovelace");
}

export function testBulkCancellationAndProgress(): void {
  const jobId = "job-test-1";
  clearBulkCancel(jobId);
  assert.equal(isBulkCancelRequested(jobId), false);
  requestBulkCancel(jobId);
  assert.equal(isBulkCancelRequested(jobId, false), true);
  assert.equal(isBulkCancelRequested(jobId, true), true);
  clearBulkCancel(jobId);

  assert.equal(computeBulkPercent(0, 10), 0);
  assert.equal(computeBulkPercent(5, 10), 50);
  assert.equal(computeBulkPercent(10, 10), 100);
  assert.equal(computeBulkPercent(3, 0), 0);

  assert.equal(
    resolveTerminalStatus({
      cancelRequested: true,
      successRows: 2,
      failedRows: 0,
      processedRows: 2,
      totalRows: 10,
    }),
    "cancelled",
  );
  assert.equal(
    resolveTerminalStatus({
      cancelRequested: false,
      successRows: 0,
      failedRows: 5,
      processedRows: 5,
      totalRows: 5,
    }),
    "failed",
  );
  assert.equal(
    resolveTerminalStatus({
      cancelRequested: false,
      successRows: 4,
      failedRows: 1,
      processedRows: 5,
      totalRows: 5,
    }),
    "completed",
  );
  assert.equal(isTerminalBulkStatus("completed"), true);
  assert.equal(isTerminalBulkStatus("processing"), false);
}
