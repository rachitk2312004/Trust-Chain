import { createHash } from "node:crypto";
import {
  RetentionDefaults,
  RetentionDispositionActions,
  RetentionTargetTypeList,
} from "@trustchain/config";

export type RetentionCandidate = {
  targetType: string;
  targetId: string;
  createdAt: Date | string;
  /** Optional explicit expiration override. */
  expiresAt?: Date | string | null;
};

export type RetentionPolicyEval = {
  id: string;
  targetType: string;
  retentionDays: number;
  disposition: string;
  status: string;
  priority: number;
};

export type LegalHoldEval = {
  id: string;
  status: string;
  scope: string;
  targetType?: string | null;
  targetIds: string[];
  startsAt: Date | string;
  endsAt?: Date | string | null;
};

export function isRetentionTargetType(value: string): boolean {
  return (RetentionTargetTypeList as readonly string[]).includes(value);
}

export function computeExpiresAt(
  createdAt: Date | string,
  retentionDays: number,
  now = new Date(),
): Date {
  const days = Math.min(
    RetentionDefaults.maxRetentionDays,
    Math.max(RetentionDefaults.minRetentionDays, retentionDays),
  );
  const base = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const expires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  // ensure expires is a Date even if clock skew; evaluation uses <= now
  void now;
  return expires;
}

export function isExpired(
  candidate: RetentionCandidate,
  retentionDays: number,
  now = new Date(),
): boolean {
  if (candidate.expiresAt) {
    const exp =
      typeof candidate.expiresAt === "string"
        ? new Date(candidate.expiresAt)
        : candidate.expiresAt;
    return exp.getTime() <= now.getTime();
  }
  return computeExpiresAt(candidate.createdAt, retentionDays, now).getTime() <= now.getTime();
}

/** Pick highest-priority (lowest number) active policy for a target type. */
export function selectPolicyForTarget(
  policies: RetentionPolicyEval[],
  targetType: string,
): RetentionPolicyEval | null {
  const matches = policies
    .filter((p) => p.status === "active" && p.targetType === targetType)
    .sort((a, b) => a.priority - b.priority || a.retentionDays - b.retentionDays);
  return matches[0] ?? null;
}

export function isHoldActive(hold: LegalHoldEval, now = new Date()): boolean {
  if (hold.status !== "active") return false;
  const starts = typeof hold.startsAt === "string" ? new Date(hold.startsAt) : hold.startsAt;
  if (starts.getTime() > now.getTime()) return false;
  if (hold.endsAt) {
    const ends = typeof hold.endsAt === "string" ? new Date(hold.endsAt) : hold.endsAt;
    if (ends.getTime() <= now.getTime()) return false;
  }
  return true;
}

/**
 * Returns true when an active legal hold blocks disposition of the target.
 */
export function isUnderLegalHold(
  holds: LegalHoldEval[],
  targetType: string,
  targetId: string,
  now = new Date(),
): boolean {
  for (const hold of holds) {
    if (!isHoldActive(hold, now)) continue;
    if (hold.scope === "all") return true;
    if (hold.scope === "target_type" && hold.targetType === targetType) return true;
    if (
      hold.scope === "targets" &&
      (hold.targetType == null || hold.targetType === targetType) &&
      hold.targetIds.includes(targetId)
    ) {
      return true;
    }
  }
  return false;
}

export type DispositionDecision =
  | { action: "skip"; reason: "not_expired" | "no_policy" | "hold_blocked" | "already_purged" }
  | { action: "archive"; policyId: string; expiresAt: Date }
  | { action: "purge"; policyId: string; expiresAt: Date };

export function evaluateDisposition(input: {
  candidate: RetentionCandidate;
  policy: RetentionPolicyEval | null;
  holds: LegalHoldEval[];
  alreadyArchived?: boolean;
  alreadyPurged?: boolean;
  now?: Date;
}): DispositionDecision {
  const now = input.now ?? new Date();
  if (input.alreadyPurged) return { action: "skip", reason: "already_purged" };
  if (!input.policy) return { action: "skip", reason: "no_policy" };
  if (!isExpired(input.candidate, input.policy.retentionDays, now)) {
    return { action: "skip", reason: "not_expired" };
  }
  if (isUnderLegalHold(input.holds, input.candidate.targetType, input.candidate.targetId, now)) {
    return { action: "skip", reason: "hold_blocked" };
  }

  const expiresAt = input.candidate.expiresAt
    ? typeof input.candidate.expiresAt === "string"
      ? new Date(input.candidate.expiresAt)
      : input.candidate.expiresAt
    : computeExpiresAt(input.candidate.createdAt, input.policy.retentionDays, now);

  if (input.policy.disposition === RetentionDispositionActions.purge) {
    // Archive-first then purge when not yet archived.
    if (!input.alreadyArchived) {
      return { action: "archive", policyId: input.policy.id, expiresAt };
    }
    return { action: "purge", policyId: input.policy.id, expiresAt };
  }

  if (input.alreadyArchived) {
    return { action: "skip", reason: "not_expired" };
  }
  return { action: "archive", policyId: input.policy.id, expiresAt };
}

export function buildArchiveIntegrityHash(input: {
  organizationId: string;
  targetType: string;
  targetId: string;
  snapshotCanonical: string;
  previousHash: string | null;
  archivedAt: string;
}): string {
  const payload = [
    input.organizationId,
    input.targetType,
    input.targetId,
    input.snapshotCanonical,
    input.previousHash ?? "",
    input.archivedAt,
  ].join("|");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function buildCustodyIntegrityHash(input: {
  organizationId: string;
  targetType: string;
  targetId: string;
  action: string;
  previousHash: string | null;
  createdAt: string;
}): string {
  const payload = [
    input.organizationId,
    input.targetType,
    input.targetId,
    input.action,
    input.previousHash ?? "",
    input.createdAt,
  ].join("|");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function verifyRetentionChain(
  events: Array<{ previousHash: string | null; integrityHash: string }>,
): boolean {
  let previous: string | null = null;
  for (const event of events) {
    if ((event.previousHash ?? null) !== previous) return false;
    if (!event.integrityHash || event.integrityHash.length !== 64) return false;
    previous = event.integrityHash;
  }
  return true;
}

export function canPurgeTarget(targetType: string): boolean {
  // Audit events are immutable — never hard-purge; archive-only soft mark.
  return targetType !== "audit_event";
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Starts automated retention ticks when RETENTION_SCHEDULER_ENABLED=true.
 * Each tick invokes the provided runner (typically org-wide dry/live runs).
 */
export function startRetentionScheduler(options?: {
  intervalMs?: number;
  force?: boolean;
  runner?: () => Promise<void>;
}): void {
  if (timer) return;
  const enabled =
    options?.force === true ||
    process.env.RETENTION_SCHEDULER_ENABLED === "true" ||
    process.env.RETENTION_SCHEDULER_ENABLED === "1";
  if (!enabled) return;

  const intervalMs = options?.intervalMs ?? RetentionDefaults.schedulerIntervalMs;
  const runner = options?.runner;
  if (!runner) return;

  timer = setInterval(() => {
    if (running) return;
    running = true;
    void runner()
      .catch((err: unknown) => {
        console.error("[retention] scheduler tick failed", err);
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
}

export function stopRetentionScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
}

export function isRetentionSchedulerRunning(): boolean {
  return timer != null;
}
