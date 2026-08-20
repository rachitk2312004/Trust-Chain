import { RetentionArchiveStatuses } from "@trustchain/config";
import {
  buildArchiveIntegrityHash,
  canPurgeTarget,
  type RetentionCandidate,
} from "./retention.scheduler.js";

export type ArchiveSnapshot = {
  targetType: string;
  targetId: string;
  capturedAt: string;
  fields: Record<string, unknown>;
};

export function buildArchiveSnapshot(input: {
  candidate: RetentionCandidate;
  fields: Record<string, unknown>;
  now?: Date;
}): ArchiveSnapshot {
  const now = input.now ?? new Date();
  return {
    targetType: input.candidate.targetType,
    targetId: input.candidate.targetId,
    capturedAt: now.toISOString(),
    fields: input.fields,
  };
}

export function canonicalizeSnapshot(snapshot: ArchiveSnapshot): string {
  return JSON.stringify(snapshot, Object.keys(snapshot).sort());
}

export function createArchiveRecord(input: {
  organizationId: string;
  candidate: RetentionCandidate;
  fields: Record<string, unknown>;
  policyId: string | null;
  expiresAt: Date;
  previousHash: string | null;
  holdBlocked?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const snapshot = buildArchiveSnapshot({
    candidate: input.candidate,
    fields: input.fields,
    now,
  });
  const archivedAt = now.toISOString();
  const integrityHash = buildArchiveIntegrityHash({
    organizationId: input.organizationId,
    targetType: input.candidate.targetType,
    targetId: input.candidate.targetId,
    snapshotCanonical: canonicalizeSnapshot(snapshot),
    previousHash: input.previousHash,
    archivedAt,
  });

  return {
    organizationId: input.organizationId,
    targetType: input.candidate.targetType,
    targetId: input.candidate.targetId,
    policyId: input.policyId,
    status: input.holdBlocked
      ? RetentionArchiveStatuses.holdBlocked
      : RetentionArchiveStatuses.archived,
    expiresAt: input.expiresAt,
    archivedAt: now,
    snapshot,
    integrityHash,
    previousHash: input.previousHash,
    holdBlocked: Boolean(input.holdBlocked),
  };
}

export function markArchivePurged(input: {
  targetType: string;
  archivedStatus: string;
  holdBlocked?: boolean;
  now?: Date;
}): { ok: boolean; status?: string; purgedAt?: Date; reason?: string } {
  if (input.holdBlocked) {
    return { ok: false, reason: "hold_blocked" };
  }
  if (input.archivedStatus === RetentionArchiveStatuses.purged) {
    return { ok: false, reason: "already_purged" };
  }
  if (!canPurgeTarget(input.targetType)) {
    return { ok: false, reason: "immutable_target" };
  }
  return {
    ok: true,
    status: RetentionArchiveStatuses.purged,
    purgedAt: input.now ?? new Date(),
  };
}

export function summarizeRetentionReport(input: {
  archived: number;
  purged: number;
  holdBlocked: number;
  skipped: number;
  chainValid: boolean;
}) {
  return {
    archived: input.archived,
    purged: input.purged,
    holdBlocked: input.holdBlocked,
    skipped: input.skipped,
    processed: input.archived + input.purged + input.holdBlocked + input.skipped,
    chainValid: input.chainValid,
  };
}
