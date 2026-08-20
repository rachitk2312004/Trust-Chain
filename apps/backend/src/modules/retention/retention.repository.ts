import {
  LegalHoldStatuses,
  RetentionArchiveStatuses,
  RetentionCustodyActions,
  RetentionDefaults,
  RetentionRunStatuses,
  RetentionTargetTypes,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import {
  createArchiveRecord,
  markArchivePurged,
  summarizeRetentionReport,
} from "./retention.archive.js";
import {
  buildCustodyIntegrityHash,
  evaluateDisposition,
  selectPolicyForTarget,
  type LegalHoldEval,
  type RetentionCandidate,
  type RetentionPolicyEval,
  verifyRetentionChain,
} from "./retention.scheduler.js";

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function toPublicPolicy(row: {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  targetType: string;
  retentionDays: number;
  disposition: string;
  status: string;
  priority: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    targetType: row.targetType,
    retentionDays: row.retentionDays,
    disposition: row.disposition,
    status: row.status,
    priority: row.priority,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicHold(row: {
  id: string;
  organizationId: string;
  name: string;
  reason: string;
  status: string;
  scope: string;
  targetType: string | null;
  targetIdsJson: Prisma.JsonValue;
  startsAt: Date;
  endsAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    reason: row.reason,
    status: row.status,
    scope: row.scope,
    targetType: row.targetType,
    targetIds: asStringArray(row.targetIdsJson),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPolicies(query: {
  organizationId: string;
  targetType?: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.RetentionPolicyWhereInput = {
    organizationId: query.organizationId,
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.retentionPolicy.findMany({
      where,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.retentionPolicy.count({ where }),
  ]);
  return { policies: rows.map(toPublicPolicy), total, limit: query.limit, offset: query.offset };
}

export async function createPolicy(input: {
  organizationId: string;
  name: string;
  description?: string | null;
  targetType: string;
  retentionDays: number;
  disposition: string;
  status?: string;
  priority?: number;
  createdById?: string | null;
}) {
  const row = await prisma.retentionPolicy.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description ?? null,
      targetType: input.targetType,
      retentionDays: input.retentionDays,
      disposition: input.disposition,
      status: input.status ?? "active",
      priority: input.priority ?? 100,
      createdById: input.createdById ?? null,
    },
  });
  return toPublicPolicy(row);
}

export async function getPolicy(id: string) {
  return prisma.retentionPolicy.findUnique({ where: { id } });
}

export async function patchPolicy(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    retentionDays?: number;
    disposition?: string;
    status?: string;
    priority?: number;
  },
) {
  const row = await prisma.retentionPolicy.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.retentionDays !== undefined ? { retentionDays: input.retentionDays } : {}),
      ...(input.disposition !== undefined ? { disposition: input.disposition } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
    },
  });
  return toPublicPolicy(row);
}

export async function listHolds(query: {
  organizationId: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.LegalHoldWhereInput = {
    organizationId: query.organizationId,
    ...(query.status ? { status: query.status } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.legalHold.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.legalHold.count({ where }),
  ]);
  return { holds: rows.map(toPublicHold), total, limit: query.limit, offset: query.offset };
}

export async function createHold(input: {
  organizationId: string;
  name: string;
  reason: string;
  scope: string;
  targetType?: string | null;
  targetIds?: string[];
  startsAt?: Date;
  endsAt?: Date | null;
  createdById?: string | null;
}) {
  const row = await prisma.legalHold.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      reason: input.reason,
      scope: input.scope,
      targetType: input.targetType ?? null,
      targetIdsJson: input.targetIds ?? [],
      startsAt: input.startsAt ?? new Date(),
      endsAt: input.endsAt ?? null,
      createdById: input.createdById ?? null,
      status: LegalHoldStatuses.active,
    },
  });
  return toPublicHold(row);
}

export async function getHold(id: string) {
  return prisma.legalHold.findUnique({ where: { id } });
}

export async function patchHold(
  id: string,
  input: {
    name?: string;
    reason?: string;
    status?: string;
    endsAt?: Date | null;
    targetIds?: string[];
  },
) {
  const row = await prisma.legalHold.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.targetIds !== undefined ? { targetIdsJson: input.targetIds } : {}),
    },
  });
  return toPublicHold(row);
}

async function appendCustody(input: {
  organizationId: string;
  targetType: string;
  targetId: string;
  action: string;
  actorUserId?: string | null;
  details?: Record<string, unknown> | null;
}) {
  const last = await prisma.retentionCustodyEvent.findFirst({
    where: {
      organizationId: input.organizationId,
      targetType: input.targetType,
      targetId: input.targetId,
    },
    orderBy: { createdAt: "desc" },
    select: { integrityHash: true },
  });
  const createdAt = new Date().toISOString();
  const previousHash = last?.integrityHash ?? null;
  const integrityHash = buildCustodyIntegrityHash({
    organizationId: input.organizationId,
    targetType: input.targetType,
    targetId: input.targetId,
    action: input.action,
    previousHash,
    createdAt,
  });
  return prisma.retentionCustodyEvent.create({
    data: {
      organizationId: input.organizationId,
      targetType: input.targetType,
      targetId: input.targetId,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      previousHash,
      integrityHash,
      detailsJson: (input.details ?? undefined) as Prisma.InputJsonValue | undefined,
      createdAt: new Date(createdAt),
    },
  });
}

async function loadCandidates(
  organizationId: string,
  targetType: string,
  limit: number,
): Promise<Array<RetentionCandidate & { fields: Record<string, unknown> }>> {
  if (targetType === RetentionTargetTypes.document) {
    const rows = await prisma.document.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        title: true,
        status: true,
        archivedAt: true,
      },
    });
    return rows.map((r) => ({
      targetType,
      targetId: r.id,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      fields: {
        title: r.title,
        status: r.status,
        archivedAt: r.archivedAt?.toISOString() ?? null,
      },
    }));
  }

  if (targetType === RetentionTargetTypes.certificate) {
    const rows = await prisma.certificate.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, createdAt: true, expiresAt: true, status: true, publicId: true },
    });
    return rows.map((r) => ({
      targetType,
      targetId: r.id,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      fields: { status: r.status, publicId: r.publicId },
    }));
  }

  if (targetType === RetentionTargetTypes.signature) {
    const rows = await prisma.signature.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, createdAt: true, expiresAt: true, status: true, publicId: true },
    });
    return rows.map((r) => ({
      targetType,
      targetId: r.id,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      fields: { status: r.status, publicId: r.publicId },
    }));
  }

  if (targetType === RetentionTargetTypes.auditEvent) {
    const rows = await prisma.platformAuditEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        action: true,
        resourceType: true,
        resourceId: true,
        integrityHash: true,
      },
    });
    return rows.map((r) => ({
      targetType,
      targetId: r.id,
      createdAt: r.createdAt,
      fields: {
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        integrityHash: r.integrityHash,
      },
    }));
  }

  if (targetType === RetentionTargetTypes.evidence) {
    const rows = await prisma.complianceEvidence.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        title: true,
        status: true,
        publicCode: true,
        checksumSha256: true,
      },
    });
    return rows.map((r) => ({
      targetType,
      targetId: r.id,
      createdAt: r.createdAt,
      fields: {
        title: r.title,
        status: r.status,
        publicCode: r.publicCode,
        checksumSha256: r.checksumSha256,
      },
    }));
  }

  if (targetType === RetentionTargetTypes.report) {
    const rows = await prisma.complianceReport.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, createdAt: true, title: true, framework: true, status: true },
    });
    return rows.map((r) => ({
      targetType,
      targetId: r.id,
      createdAt: r.createdAt,
      fields: { title: r.title, framework: r.framework, status: r.status },
    }));
  }

  return [];
}

async function applySoftTargetEffects(input: {
  targetType: string;
  targetId: string;
  action: "archive" | "purge";
}) {
  if (input.targetType === RetentionTargetTypes.document) {
    if (input.action === "archive") {
      await prisma.document.updateMany({
        where: { id: input.targetId, deletedAt: null },
        data: { archivedAt: new Date() },
      });
    } else {
      await prisma.document.updateMany({
        where: { id: input.targetId },
        data: { deletedAt: new Date(), archivedAt: new Date() },
      });
    }
  }
  if (input.targetType === RetentionTargetTypes.evidence && input.action === "archive") {
    await prisma.complianceEvidence.updateMany({
      where: { id: input.targetId },
      data: { status: "archived" },
    });
  }
}

export async function runRetentionForOrganization(input: {
  organizationId: string;
  dryRun: boolean;
  targetType?: string;
  limit: number;
  actorUserId?: string | null;
}) {
  const now = new Date();
  const run = await prisma.retentionRun.create({
    data: {
      organizationId: input.organizationId,
      status: RetentionRunStatuses.running,
      dryRun: input.dryRun,
      triggeredById: input.actorUserId ?? null,
      startedAt: now,
    },
  });

  try {
    const [policyRows, holdRows] = await Promise.all([
      prisma.retentionPolicy.findMany({
        where: { organizationId: input.organizationId, status: "active" },
      }),
      prisma.legalHold.findMany({
        where: { organizationId: input.organizationId, status: LegalHoldStatuses.active },
      }),
    ]);

    const policies: RetentionPolicyEval[] = policyRows.map((p) => ({
      id: p.id,
      targetType: p.targetType,
      retentionDays: p.retentionDays,
      disposition: p.disposition,
      status: p.status,
      priority: p.priority,
    }));

    const holds: LegalHoldEval[] = holdRows.map((h) => ({
      id: h.id,
      status: h.status,
      scope: h.scope,
      targetType: h.targetType,
      targetIds: asStringArray(h.targetIdsJson),
      startsAt: h.startsAt,
      endsAt: h.endsAt,
    }));

    const targetTypes = input.targetType
      ? [input.targetType]
      : [...new Set(policies.map((p) => p.targetType))];

    let archived = 0;
    let purged = 0;
    let holdBlocked = 0;
    let skipped = 0;
    const decisions: Array<Record<string, unknown>> = [];

    for (const targetType of targetTypes) {
      const policy = selectPolicyForTarget(policies, targetType);
      if (!policy) continue;

      const candidates = await loadCandidates(
        input.organizationId,
        targetType,
        Math.min(input.limit, RetentionDefaults.maxRunBatch),
      );

      for (const candidate of candidates) {
        const existing = await prisma.retentionArchive.findUnique({
          where: {
            organizationId_targetType_targetId: {
              organizationId: input.organizationId,
              targetType: candidate.targetType,
              targetId: candidate.targetId,
            },
          },
        });

        const decision = evaluateDisposition({
          candidate,
          policy,
          holds,
          alreadyArchived:
            Boolean(existing) &&
            existing!.status !== RetentionArchiveStatuses.holdBlocked,
          alreadyPurged: existing?.status === RetentionArchiveStatuses.purged,
          now,
        });

        if (decision.action === "skip") {
          if (decision.reason === "hold_blocked") holdBlocked += 1;
          else skipped += 1;
          decisions.push({
            targetType: candidate.targetType,
            targetId: candidate.targetId,
            ...decision,
          });
          continue;
        }

        if (decision.action === "archive") {
          if (input.dryRun) {
            archived += 1;
            decisions.push({
              targetType: candidate.targetType,
              targetId: candidate.targetId,
              action: "archive",
              dryRun: true,
            });
            continue;
          }

          const lastOrg = await prisma.retentionArchive.findFirst({
            where: { organizationId: input.organizationId },
            orderBy: { createdAt: "desc" },
            select: { integrityHash: true },
          });
          const record = createArchiveRecord({
            organizationId: input.organizationId,
            candidate,
            fields: candidate.fields,
            policyId: decision.policyId,
            expiresAt: decision.expiresAt,
            previousHash: lastOrg?.integrityHash ?? null,
            now,
          });

          await prisma.retentionArchive.upsert({
            where: {
              organizationId_targetType_targetId: {
                organizationId: input.organizationId,
                targetType: candidate.targetType,
                targetId: candidate.targetId,
              },
            },
            create: {
              organizationId: record.organizationId,
              targetType: record.targetType,
              targetId: record.targetId,
              policyId: record.policyId,
              status: record.status,
              expiresAt: record.expiresAt,
              archivedAt: record.archivedAt,
              snapshotJson: record.snapshot as unknown as Prisma.InputJsonValue,
              integrityHash: record.integrityHash,
              previousHash: record.previousHash,
              holdBlocked: false,
            },
            update: {
              status: RetentionArchiveStatuses.archived,
              expiresAt: record.expiresAt,
              archivedAt: record.archivedAt,
              snapshotJson: record.snapshot as unknown as Prisma.InputJsonValue,
              integrityHash: record.integrityHash,
              previousHash: record.previousHash,
              holdBlocked: false,
              policyId: record.policyId,
            },
          });

          await applySoftTargetEffects({
            targetType: candidate.targetType,
            targetId: candidate.targetId,
            action: "archive",
          });
          await appendCustody({
            organizationId: input.organizationId,
            targetType: candidate.targetType,
            targetId: candidate.targetId,
            action: RetentionCustodyActions.archived,
            actorUserId: input.actorUserId,
            details: { policyId: decision.policyId },
          });
          archived += 1;
          decisions.push({
            targetType: candidate.targetType,
            targetId: candidate.targetId,
            action: "archive",
          });
          continue;
        }

        if (decision.action === "purge") {
          if (input.dryRun) {
            purged += 1;
            decisions.push({
              targetType: candidate.targetType,
              targetId: candidate.targetId,
              action: "purge",
              dryRun: true,
            });
            continue;
          }

          const purge = markArchivePurged({
            targetType: candidate.targetType,
            archivedStatus: existing?.status ?? RetentionArchiveStatuses.archived,
            holdBlocked: false,
            now,
          });
          if (!purge.ok) {
            skipped += 1;
            decisions.push({
              targetType: candidate.targetType,
              targetId: candidate.targetId,
              action: "skip",
              reason: purge.reason,
            });
            continue;
          }

          if (existing) {
            await prisma.retentionArchive.update({
              where: { id: existing.id },
              data: {
                status: RetentionArchiveStatuses.purged,
                purgedAt: purge.purgedAt,
              },
            });
          }

          await applySoftTargetEffects({
            targetType: candidate.targetType,
            targetId: candidate.targetId,
            action: "purge",
          });
          await appendCustody({
            organizationId: input.organizationId,
            targetType: candidate.targetType,
            targetId: candidate.targetId,
            action: RetentionCustodyActions.purged,
            actorUserId: input.actorUserId,
            details: { policyId: decision.policyId },
          });
          purged += 1;
          decisions.push({
            targetType: candidate.targetType,
            targetId: candidate.targetId,
            action: "purge",
          });
        }
      }
    }

    const custodySample = await prisma.retentionCustodyEvent.findMany({
      where: { organizationId: input.organizationId },
      orderBy: [{ targetType: "asc" }, { targetId: "asc" }, { createdAt: "asc" }],
      take: 500,
      select: { previousHash: true, integrityHash: true, targetType: true, targetId: true },
    });

    // Verify per-target chains
    let chainValid = true;
    const byTarget = new Map<string, Array<{ previousHash: string | null; integrityHash: string }>>();
    for (const ev of custodySample) {
      const key = `${ev.targetType}:${ev.targetId}`;
      const list = byTarget.get(key) ?? [];
      list.push({ previousHash: ev.previousHash, integrityHash: ev.integrityHash });
      byTarget.set(key, list);
    }
    for (const events of byTarget.values()) {
      if (!verifyRetentionChain(events)) {
        chainValid = false;
        break;
      }
    }

    const report = summarizeRetentionReport({
      archived,
      purged,
      holdBlocked,
      skipped,
      chainValid,
    });
    const summary = { ...report, decisions: decisions.slice(0, 100), dryRun: input.dryRun };

    const finished = await prisma.retentionRun.update({
      where: { id: run.id },
      data: {
        status: RetentionRunStatuses.completed,
        summaryJson: summary as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });

    return {
      run: {
        id: finished.id,
        organizationId: finished.organizationId,
        status: finished.status,
        dryRun: finished.dryRun,
        summary,
        startedAt: finished.startedAt?.toISOString() ?? null,
        finishedAt: finished.finishedAt?.toISOString() ?? null,
        createdAt: finished.createdAt.toISOString(),
      },
    };
  } catch (error) {
    await prisma.retentionRun.update({
      where: { id: run.id },
      data: {
        status: RetentionRunStatuses.failed,
        errorMessage: error instanceof Error ? error.message : "Retention run failed",
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function getRetentionStatus(organizationId: string) {
  const [policyCount, activeHolds, archiveCounts, latestRun, custodySample] = await Promise.all([
    prisma.retentionPolicy.count({ where: { organizationId, status: "active" } }),
    prisma.legalHold.count({ where: { organizationId, status: LegalHoldStatuses.active } }),
    prisma.retentionArchive.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.retentionRun.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.retentionCustodyEvent.findMany({
      where: { organizationId },
      orderBy: [{ targetType: "asc" }, { targetId: "asc" }, { createdAt: "asc" }],
      take: 500,
      select: { previousHash: true, integrityHash: true, targetType: true, targetId: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of archiveCounts) {
    byStatus[row.status] = row._count._all;
  }

  let chainValid = true;
  const byTarget = new Map<string, Array<{ previousHash: string | null; integrityHash: string }>>();
  for (const ev of custodySample) {
    const key = `${ev.targetType}:${ev.targetId}`;
    const list = byTarget.get(key) ?? [];
    list.push({ previousHash: ev.previousHash, integrityHash: ev.integrityHash });
    byTarget.set(key, list);
  }
  for (const events of byTarget.values()) {
    if (!verifyRetentionChain(events)) {
      chainValid = false;
      break;
    }
  }

  return {
    organizationId,
    activePolicies: policyCount,
    activeHolds,
    archives: {
      archived: byStatus[RetentionArchiveStatuses.archived] ?? 0,
      purged: byStatus[RetentionArchiveStatuses.purged] ?? 0,
      holdBlocked: byStatus[RetentionArchiveStatuses.holdBlocked] ?? 0,
    },
    chainValid,
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          dryRun: latestRun.dryRun,
          summary: latestRun.summaryJson,
          createdAt: latestRun.createdAt.toISOString(),
          finishedAt: latestRun.finishedAt?.toISOString() ?? null,
        }
      : null,
  };
}
