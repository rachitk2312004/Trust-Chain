import { createHash, randomUUID } from "node:crypto";

export type AuditEventInput = {
  correlationId?: string;
  requestId?: string | null;
  source: string;
  action: string;
  actorUserId?: string | null;
  actorIp?: string | null;
  organizationId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  success?: boolean;
  meta?: Record<string, unknown> | null;
  previousHash?: string | null;
  createdAt?: string | Date;
};

export type AuditEventRecord = {
  id: string;
  correlationId: string;
  requestId: string | null;
  source: string;
  action: string;
  actorUserId: string | null;
  actorIp: string | null;
  organizationId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  success: boolean;
  meta: unknown;
  integrityHash: string;
  previousHash: string | null;
  createdAt: string;
};

export function generateCorrelationId(): string {
  return `corr_${randomUUID().replace(/-/g, "")}`;
}

export function canonicalAuditPayload(input: {
  correlationId: string;
  requestId: string | null;
  source: string;
  action: string;
  actorUserId: string | null;
  actorIp: string | null;
  organizationId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  success: boolean;
  meta: unknown;
  previousHash: string | null;
  createdAt: string;
}): string {
  return JSON.stringify({
    correlationId: input.correlationId,
    requestId: input.requestId,
    source: input.source,
    action: input.action,
    actorUserId: input.actorUserId,
    actorIp: input.actorIp,
    organizationId: input.organizationId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    success: input.success,
    meta: input.meta ?? null,
    previousHash: input.previousHash,
    createdAt: input.createdAt,
  });
}

export function computeIntegrityHash(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function buildAuditEvent(
  input: AuditEventInput,
  options?: { id?: string },
): AuditEventRecord {
  const createdAt = new Date(input.createdAt ?? Date.now()).toISOString();
  const correlationId = input.correlationId?.trim() || generateCorrelationId();
  const base = {
    correlationId,
    requestId: input.requestId ?? null,
    source: input.source,
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    actorIp: input.actorIp ?? null,
    organizationId: input.organizationId ?? null,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    success: input.success ?? true,
    meta: input.meta ?? null,
    previousHash: input.previousHash ?? null,
    createdAt,
  };
  const integrityHash = computeIntegrityHash(canonicalAuditPayload(base));
  return {
    id: options?.id ?? randomUUID(),
    ...base,
    integrityHash,
  };
}

export function verifyAuditEventIntegrity(event: AuditEventRecord): boolean {
  const expected = computeIntegrityHash(
    canonicalAuditPayload({
      correlationId: event.correlationId,
      requestId: event.requestId,
      source: event.source,
      action: event.action,
      actorUserId: event.actorUserId,
      actorIp: event.actorIp,
      organizationId: event.organizationId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      success: event.success,
      meta: event.meta,
      previousHash: event.previousHash,
      createdAt: event.createdAt,
    }),
  );
  return expected === event.integrityHash;
}

export type AuditFilter = {
  organizationId?: string;
  action?: string;
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
  correlationId?: string;
  requestId?: string;
  source?: string;
  success?: boolean;
  actorIp?: string;
  from?: string;
  to?: string;
  q?: string;
};

export function matchesPlatformAuditFilter(
  event: AuditEventRecord,
  filters: AuditFilter,
): boolean {
  if (filters.organizationId && event.organizationId !== filters.organizationId) return false;
  if (filters.action && event.action !== filters.action) return false;
  if (filters.actorUserId && event.actorUserId !== filters.actorUserId) return false;
  if (filters.resourceType && event.resourceType !== filters.resourceType) return false;
  if (filters.resourceId && event.resourceId !== filters.resourceId) return false;
  if (filters.correlationId && event.correlationId !== filters.correlationId) return false;
  if (filters.requestId && event.requestId !== filters.requestId) return false;
  if (filters.source && event.source !== filters.source) return false;
  if (filters.success !== undefined && event.success !== filters.success) return false;
  if (filters.actorIp && event.actorIp !== filters.actorIp) return false;
  if (filters.from && event.createdAt < filters.from) return false;
  if (filters.to && event.createdAt > filters.to) return false;
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    const hay = [
      event.action,
      event.source,
      event.correlationId,
      event.requestId ?? "",
      event.actorUserId ?? "",
      event.actorIp ?? "",
      event.resourceType ?? "",
      event.resourceId ?? "",
      JSON.stringify(event.meta ?? {}),
    ]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

export function filterAuditEvents(
  events: AuditEventRecord[],
  filters: AuditFilter,
): AuditEventRecord[] {
  return events.filter((event) => matchesPlatformAuditFilter(event, filters));
}

export type TimelineBucket = {
  day: string;
  count: number;
  success: number;
  failure: number;
  events: AuditEventRecord[];
};

export type TimelineView = {
  correlationId: string | null;
  resourceKey: string | null;
  requestId: string | null;
  events: AuditEventRecord[];
  buckets: TimelineBucket[];
  chainValid: boolean;
  actors: string[];
  resources: Array<{ type: string; id: string }>;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function groupEventsByDay(events: AuditEventRecord[]): TimelineBucket[] {
  const map = new Map<string, TimelineBucket>();
  const ordered = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const event of ordered) {
    const day = dayKey(event.createdAt);
    const row = map.get(day) ?? {
      day,
      count: 0,
      success: 0,
      failure: 0,
      events: [],
    };
    row.count += 1;
    if (event.success) row.success += 1;
    else row.failure += 1;
    row.events.push(event);
    map.set(day, row);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Verify hash-chain linkage within a correlation group. */
export function verifyCorrelationChain(events: AuditEventRecord[]): boolean {
  const ordered = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let previous: string | null = null;
  for (let i = 0; i < ordered.length; i += 1) {
    const event = ordered[i]!;
    if (i === 0) {
      if (event.previousHash != null) return false;
    } else if (event.previousHash !== previous) {
      return false;
    }
    previous = event.integrityHash;
  }
  return true;
}

export function buildTimeline(
  events: AuditEventRecord[],
  options?: {
    correlationId?: string | null;
    requestId?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
  },
): TimelineView {
  let filtered = [...events];
  if (options?.correlationId) {
    filtered = filtered.filter((e) => e.correlationId === options.correlationId);
  }
  if (options?.requestId) {
    filtered = filtered.filter((e) => e.requestId === options.requestId);
  }
  if (options?.resourceType) {
    filtered = filtered.filter((e) => e.resourceType === options.resourceType);
  }
  if (options?.resourceId) {
    filtered = filtered.filter((e) => e.resourceId === options.resourceId);
  }

  const ordered = filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const actors = [
    ...new Set(ordered.map((e) => e.actorUserId).filter((v): v is string => Boolean(v))),
  ];
  const resources = ordered
    .filter((e) => e.resourceType && e.resourceId)
    .map((e) => ({ type: e.resourceType!, id: e.resourceId! }));
  const uniqueResources = [
    ...new Map(resources.map((r) => [`${r.type}:${r.id}`, r])).values(),
  ];

  return {
    correlationId: options?.correlationId ?? ordered[0]?.correlationId ?? null,
    requestId: options?.requestId ?? ordered[0]?.requestId ?? null,
    resourceKey:
      options?.resourceType && options?.resourceId
        ? `${options.resourceType}:${options.resourceId}`
        : uniqueResources[0]
          ? `${uniqueResources[0].type}:${uniqueResources[0].id}`
          : null,
    events: ordered,
    buckets: groupEventsByDay(ordered),
    chainValid: verifyCorrelationChain(ordered),
    actors,
    resources: uniqueResources,
  };
}

/** Replay: reconstruct ordered chain for correlated events. */
export function replayCorrelationEvents(events: AuditEventRecord[]): Array<{
  event: AuditEventRecord;
  sequence: number;
  linked: boolean;
}> {
  const ordered = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let previous: string | null = null;
  return ordered.map((event, index) => {
    const linked = index === 0 ? event.previousHash == null : event.previousHash === previous;
    previous = event.integrityHash;
    return { event, sequence: index + 1, linked };
  });
}
