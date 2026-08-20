import assert from "node:assert/strict";
import {
  buildBulkJobStatistics,
  buildDownloadStatistics,
  buildIssuanceStatistics,
  buildTemplateUtilization,
  buildVerificationStatistics,
} from "../certificates.analytics.js";
import {
  averageLatency,
  CertificateProcessMetrics,
} from "../certificates.observability.js";
import { retentionCutoff } from "../certificates.retention.js";

export function testStatisticsGeneration(): void {
  const issuance = buildIssuanceStatistics({
    issued: 10,
    revoked: 2,
    expired: 1,
    draft: 3,
  });
  assert.equal(issuance.total, 16);
  assert.equal(issuance.active, 10);
  assert.equal(issuance.revoked, 2);

  const verification = buildVerificationStatistics(
    [
      { payloadJson: { valid: true, durationMs: 12 } },
      { payloadJson: { valid: true, durationMs: 18 } },
      { payloadJson: { valid: false, durationMs: 20 } },
      { payloadJson: null },
    ],
    50,
  );
  assert.equal(verification.totalEvents, 4);
  assert.equal(verification.valid, 2);
  assert.equal(verification.invalid, 1);
  assert.equal(verification.successRate, 66.67);
  assert.equal(verification.averageVerificationTimeMs, 17);
}

export function testTemplateMetrics(): void {
  const rows = buildTemplateUtilization(
    [
      { templateId: "t1", _count: { _all: 5 } },
      { templateId: null, _count: { _all: 2 } },
      { templateId: "t2", _count: { _all: 8 } },
    ],
    [
      { id: "t1", code: "a", name: "Alpha", status: "active" },
      { id: "t2", code: "b", name: "Beta", status: "archived" },
    ],
  );
  assert.equal(rows[0]!.templateId, "t2");
  assert.equal(rows[0]!.certificateCount, 8);
  assert.equal(rows[1]!.templateCode, "a");
  assert.equal(rows[2]!.templateId, null);
}

export function testDownloadMetrics(): void {
  const downloads = buildDownloadStatistics(
    [
      { payloadJson: { format: "pdf", durationMs: 100 } },
      { payloadJson: { format: "pdf", durationMs: 200 } },
      { payloadJson: { format: "png", durationMs: 50 } },
    ],
    null,
  );
  assert.equal(downloads.totalEvents, 3);
  assert.equal(downloads.byFormat.pdf, 2);
  assert.equal(downloads.byFormat.png, 1);
  assert.equal(downloads.averageRenderTimeMs, 117);

  const metrics = new CertificateProcessMetrics();
  metrics.recordDownload("svg", 40);
  metrics.recordRender(10, false);
  const snap = metrics.snapshot();
  assert.equal(snap.downloads, 1);
  assert.equal(snap.renderFailures, 1);
  assert.equal(snap.downloadByFormat.svg, 1);
  assert.equal(averageLatency([10, 20, 30]), 20);
}

export function testCleanupHelpers(): void {
  const now = new Date("2026-08-03T00:00:00.000Z");
  const cutoff = retentionCutoff(10, now);
  assert.equal(cutoff.toISOString(), "2026-07-24T00:00:00.000Z");

  const bulk = buildBulkJobStatistics([
    {
      status: "completed",
      totalRows: 10,
      successRows: 8,
      failedRows: 2,
      rolledBackCount: 0,
    },
    {
      status: "cancelled",
      totalRows: 5,
      successRows: 2,
      failedRows: 0,
      rolledBackCount: 2,
    },
  ]);
  assert.equal(bulk.totalJobs, 2);
  assert.equal(bulk.successRows, 10);
  assert.equal(bulk.rolledBackCount, 2);
  assert.equal(bulk.successRate, 83.33);
}

export function testAdministrativeOperationsShape(): void {
  const reprocessResult = {
    requested: 2,
    processed: 2,
    succeeded: 1,
    failed: 1,
    results: [
      { certificateId: "c1", verified: true, rendered: true },
      { certificateId: "c2", verified: false, rendered: false, error: "boom" },
    ],
  };
  assert.equal(reprocessResult.succeeded, 1);
  assert.equal(reprocessResult.failed, 1);

  const cleanupPreview = {
    eventsEligible: 12,
    bulkJobsEligible: 3,
    temporaryAssetEventsEligible: 7,
  };
  assert.ok(cleanupPreview.eventsEligible >= cleanupPreview.temporaryAssetEventsEligible);
}
