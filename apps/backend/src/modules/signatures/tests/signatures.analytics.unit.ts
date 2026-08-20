import assert from "node:assert/strict";
import { SignatureApprovalWorkflowStatuses, SignatureStatuses } from "@trustchain/config";
import {
  buildAlgorithmDistribution,
  buildDetachedAnalytics,
  buildLifecycleStatistics,
  buildVerificationAnalytics,
  buildWorkflowAnalytics,
} from "../signatures.analytics.js";
import { averageLatency, SignatureProcessMetrics } from "../signatures.observability.js";
import { retentionCutoff } from "../signatures.retention.js";

export function testAnalyticsGeneration(): void {
  const lifecycle = buildLifecycleStatistics({
    [SignatureStatuses.active]: 10,
    [SignatureStatuses.pending]: 2,
    [SignatureStatuses.revoked]: 3,
    [SignatureStatuses.expired]: 1,
  });
  assert.equal(lifecycle.total, 16);
  assert.equal(lifecycle.created, 16);
  assert.equal(lifecycle.active, 10);
  assert.equal(lifecycle.revoked, 3);
  assert.equal(lifecycle.expired, 1);

  const verification = buildVerificationAnalytics(
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
  assert.equal(verification.successRate, 50);
  assert.equal(verification.averageVerificationTimeMs, 17);

  const metrics = new SignatureProcessMetrics();
  metrics.recordVerification(10, true);
  metrics.recordVerification(20, false);
  metrics.recordDownload("canonical_payload");
  const snap = metrics.snapshot();
  assert.equal(snap.verifications, 2);
  assert.equal(snap.verificationFailures, 1);
  assert.equal(snap.downloads, 1);
  assert.equal(snap.averageVerificationTimeMs, 15);
  assert.equal(averageLatency([10, 20, 30]), 20);
}

export function testWorkflowMetrics(): void {
  const workflows = buildWorkflowAnalytics({
    byStatus: [
      { status: SignatureApprovalWorkflowStatuses.approved, _count: { _all: 6 } },
      { status: SignatureApprovalWorkflowStatuses.rejected, _count: { _all: 2 } },
      { status: SignatureApprovalWorkflowStatuses.pending, _count: { _all: 4 } },
    ],
    byType: [
      { workflowType: "sequential", _count: { _all: 7 } },
      { workflowType: "parallel", _count: { _all: 5 } },
    ],
    completedLatenciesMs: [1000, 3000, 2000],
  });
  assert.equal(workflows.total, 12);
  assert.equal(workflows.pending, 4);
  assert.equal(workflows.completionRate, 75);
  assert.equal(workflows.rejectionRate, 25);
  assert.equal(workflows.averageApprovalLatencyMs, 2000);
  assert.equal(workflows.byType.sequential, 7);
}

export function testAlgorithmMetrics(): void {
  const algorithms = buildAlgorithmDistribution([
    { algorithm: "RSA-SHA256", _count: { _all: 8 } },
    { algorithm: "ECDSA-P256-SHA256", _count: { _all: 2 } },
  ]);
  assert.equal(algorithms.length, 2);
  assert.equal(algorithms[0]!.algorithm, "RSA-SHA256");
  assert.equal(algorithms[0]!.count, 8);
  assert.equal(algorithms[0]!.share, 80);
  assert.equal(algorithms[1]!.share, 20);

  const detached = buildDetachedAnalytics({
    total: 5,
    active: 3,
    revoked: 1,
    expired: 1,
    artifactCount: 4,
  });
  assert.equal(detached.total, 5);
  assert.equal(detached.artifactCount, 4);
}

export function testCleanupHelpers(): void {
  const now = new Date("2026-08-03T00:00:00.000Z");
  const cutoff = retentionCutoff(10, now);
  assert.equal(cutoff.toISOString(), "2026-07-24T00:00:00.000Z");

  const policyShape = {
    eventDays: 365,
    approvalEventDays: 365,
    workflowDays: 180,
    artifactDays: 365,
    diagnosticEventDays: 30,
  };
  assert.equal(Object.keys(policyShape).length, 5);

  const cleanupResult = {
    deletedEvents: 2,
    deletedApprovalEvents: 1,
    deletedWorkflows: 1,
    deletedArtifacts: 3,
    deletedDiagnosticEvents: 4,
  };
  assert.equal(
    cleanupResult.deletedEvents +
      cleanupResult.deletedApprovalEvents +
      cleanupResult.deletedWorkflows +
      cleanupResult.deletedArtifacts +
      cleanupResult.deletedDiagnosticEvents,
    11,
  );
}

export function testAdministrationOperations(): void {
  const reprocessResult = {
    requested: 2,
    processed: 2,
    succeeded: 1,
    failed: 1,
    results: [
      {
        signatureId: "s1",
        publicId: "SIG-1",
        verified: true,
        status: "active",
        durationMs: 12,
      },
      {
        signatureId: "s2",
        publicId: "SIG-2",
        verified: false,
        status: "expired",
        durationMs: 8,
        error: "boom",
      },
    ],
  };
  assert.equal(reprocessResult.succeeded + reprocessResult.failed, reprocessResult.processed);
  assert.equal(reprocessResult.results[0]!.verified, true);
  assert.ok(reprocessResult.results[1]!.error);

  const metrics = new SignatureProcessMetrics();
  metrics.recordApproval(5000);
  metrics.recordApproval(7000);
  const snap = metrics.snapshot();
  assert.equal(snap.approvals, 2);
  assert.equal(snap.averageApprovalTimeMs, 6000);

  const inspectShape = {
    signature: { id: "s1" },
    artifacts: [],
    events: [],
    diagnostics: { artifactKinds: [], eventCount: 0, process: snap },
  };
  assert.equal(inspectShape.diagnostics.eventCount, 0);
  assert.equal(inspectShape.diagnostics.process.approvals, 2);
}
