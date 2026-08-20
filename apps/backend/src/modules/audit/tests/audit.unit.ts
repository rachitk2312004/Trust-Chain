import assert from "node:assert/strict";
import { AuditEventSources, AuditExportFormats } from "@trustchain/config";
import {
  exportEventsToCsv,
  exportEventsToJson,
  generateAuditExport,
} from "../audit.export.js";
import {
  buildAuditEvent,
  buildTimeline,
  filterAuditEvents,
  generateCorrelationId,
  replayCorrelationEvents,
  verifyAuditEventIntegrity,
  verifyCorrelationChain,
} from "../audit.timeline.js";

export function testEventCreation(): void {
  const corr = generateCorrelationId();
  assert.ok(corr.startsWith("corr_"));

  const first = buildAuditEvent({
    correlationId: corr,
    source: AuditEventSources.platform,
    action: "document.create",
    actorUserId: "11111111-1111-1111-1111-111111111111",
    actorIp: "203.0.113.10",
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    resourceType: "document",
    resourceId: "22222222-2222-2222-2222-222222222222",
    requestId: "req_1",
    createdAt: "2026-08-01T10:00:00.000Z",
  });

  assert.equal(first.correlationId, corr);
  assert.equal(first.previousHash, null);
  assert.ok(first.integrityHash.length === 64);
  assert.equal(verifyAuditEventIntegrity(first), true);

  const second = buildAuditEvent({
    correlationId: corr,
    source: AuditEventSources.document,
    action: "document.update",
    actorUserId: first.actorUserId,
    actorIp: first.actorIp,
    organizationId: first.organizationId,
    resourceType: "document",
    resourceId: first.resourceId,
    requestId: "req_2",
    previousHash: first.integrityHash,
    createdAt: "2026-08-01T10:05:00.000Z",
  });

  assert.equal(second.previousHash, first.integrityHash);
  assert.equal(verifyAuditEventIntegrity(second), true);
  assert.notEqual(first.integrityHash, second.integrityHash);
}

export function testCorrelation(): void {
  const corr = "corr_testcorrelation";
  const a = buildAuditEvent({
    correlationId: corr,
    source: AuditEventSources.admin,
    action: "admin.user.suspend",
    createdAt: "2026-08-01T11:00:00.000Z",
  });
  const b = buildAuditEvent({
    correlationId: corr,
    source: AuditEventSources.admin,
    action: "admin.user.restore",
    previousHash: a.integrityHash,
    createdAt: "2026-08-01T11:10:00.000Z",
  });
  assert.equal(verifyCorrelationChain([a, b]), true);

  const broken = { ...b, previousHash: "deadbeef" };
  assert.equal(verifyCorrelationChain([a, broken]), false);

  const replay = replayCorrelationEvents([b, a]);
  assert.equal(replay[0]!.sequence, 1);
  assert.equal(replay[0]!.event.id, a.id);
  assert.equal(replay[1]!.linked, true);
}

export function testTimelineGeneration(): void {
  const corr = "corr_timeline";
  const events = [
    buildAuditEvent({
      correlationId: corr,
      source: AuditEventSources.verification,
      action: "verification.run",
      resourceType: "document",
      resourceId: "d1",
      actorUserId: "u1",
      success: true,
      createdAt: "2026-08-01T09:00:00.000Z",
    }),
    buildAuditEvent({
      correlationId: corr,
      source: AuditEventSources.verification,
      action: "verification.fail",
      resourceType: "document",
      resourceId: "d1",
      actorUserId: "u1",
      success: false,
      previousHash: "will-fix",
      createdAt: "2026-08-02T09:00:00.000Z",
    }),
  ];
  // Fix chain for second event
  events[1] = buildAuditEvent({
    correlationId: corr,
    source: AuditEventSources.verification,
    action: "verification.fail",
    resourceType: "document",
    resourceId: "d1",
    actorUserId: "u1",
    success: false,
    previousHash: events[0]!.integrityHash,
    createdAt: "2026-08-02T09:00:00.000Z",
  });

  const timeline = buildTimeline(events, { correlationId: corr });
  assert.equal(timeline.events.length, 2);
  assert.equal(timeline.buckets.length, 2);
  assert.equal(timeline.chainValid, true);
  assert.deepEqual(timeline.actors, ["u1"]);
  assert.equal(timeline.resources[0]?.type, "document");
}

export function testFiltering(): void {
  const events = [
    buildAuditEvent({
      source: AuditEventSources.developer,
      action: "developer.key.create",
      actorUserId: "u1",
      actorIp: "10.0.0.1",
      organizationId: "org1",
      resourceType: "api_key",
      resourceId: "k1",
      success: true,
      createdAt: "2026-08-01T00:00:00.000Z",
    }),
    buildAuditEvent({
      source: AuditEventSources.admin,
      action: "admin.tenant.suspend",
      actorUserId: "u2",
      organizationId: "org1",
      success: false,
      createdAt: "2026-08-03T00:00:00.000Z",
    }),
  ];

  const filtered = filterAuditEvents(events, {
    source: AuditEventSources.developer,
    success: true,
    q: "api_key",
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.action, "developer.key.create");

  const byIp = filterAuditEvents(events, { actorIp: "10.0.0.1" });
  assert.equal(byIp.length, 1);
}

export function testExportGeneration(): void {
  const events = [
    buildAuditEvent({
      source: AuditEventSources.platform,
      action: "search.reindex",
      organizationId: "org1",
      createdAt: "2026-08-01T00:00:00.000Z",
    }),
  ];
  const json = exportEventsToJson(events);
  assert.ok(json.includes("search.reindex"));
  assert.ok(JSON.parse(json).count === 1);

  const csv = exportEventsToCsv(events);
  assert.ok(csv.split("\n")[0]!.includes("correlationId"));
  assert.ok(csv.includes("search.reindex"));

  const generated = generateAuditExport(events, AuditExportFormats.csv);
  assert.equal(generated.rowCount, 1);
  assert.equal(generated.contentType, "text/csv");
}
