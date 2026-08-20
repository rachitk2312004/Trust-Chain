import {
  ReputationAlertSeverities,
  ReputationAlertStatuses,
  ReputationDefaults,
  ReputationProfileStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  assessFraud,
  buildAlertTitle,
  type FraudSignals,
} from "./reputation.fraud.js";
import {
  buildLeaderboard,
  calculateHistoricalTrend,
  scoreReputation,
  type ReputationSignals,
} from "./reputation.scoring.js";

function toPublicProfile(row: {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  label: string | null;
  status: string;
  trustScore: number;
  contributionScore: number;
  fraudScore: number;
  overallScore: number;
  signalsJson: Prisma.JsonValue;
  lastScoredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    label: row.label,
    status: row.status,
    trustScore: row.trustScore,
    contributionScore: row.contributionScore,
    fraudScore: row.fraudScore,
    overallScore: row.overallScore,
    signals: row.signalsJson,
    lastScoredAt: row.lastScoredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listReputation(query: {
  organizationId: string;
  subjectType?: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.ReputationProfileWhereInput = {
    organizationId: query.organizationId,
    ...(query.subjectType ? { subjectType: query.subjectType } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [profiles, total, openAlerts] = await Promise.all([
    prisma.reputationProfile.findMany({
      where,
      orderBy: [{ overallScore: "desc" }, { updatedAt: "desc" }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.reputationProfile.count({ where }),
    prisma.reputationAlert.count({
      where: {
        organizationId: query.organizationId,
        status: ReputationAlertStatuses.open,
      },
    }),
  ]);

  const avgOverall =
    profiles.length === 0
      ? ReputationDefaults.baselineTrust
      : Number(
          (
            profiles.reduce((s, p) => s + p.overallScore, 0) / profiles.length
          ).toFixed(3),
        );

  return {
    organizationId: query.organizationId,
    profiles: profiles.map(toPublicProfile),
    summary: {
      total,
      averageOverall: avgOverall,
      flagged: profiles.filter((p) => p.status === ReputationProfileStatuses.flagged)
        .length,
      openAlerts,
    },
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function scoreSubject(input: {
  organizationId: string;
  subjectType: string;
  subjectId: string;
  label?: string;
  signals?: ReputationSignals;
  fraudSignals?: FraudSignals;
  reason?: string;
  updatedById?: string | null;
}) {
  const existing = await prisma.reputationProfile.findUnique({
    where: {
      organizationId_subjectType_subjectId: {
        organizationId: input.organizationId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
    },
  });

  const historyScores = existing
    ? (
        await prisma.reputationHistoryEvent.findMany({
          where: { profileId: existing.id },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: { overallScore: true },
        })
      ).map((h) => h.overallScore)
    : [];

  const fraud = assessFraud({
    fraudSignals: input.fraudSignals ?? {},
    historyScores,
    latestOverallScore: existing?.overallScore,
  });

  const scored = scoreReputation({
    subjectType: input.subjectType,
    signals: input.signals ?? {},
    fraudScore: fraud.fraudScore,
  });

  // Re-check anomaly against newly computed overall
  const fraudFinal = assessFraud({
    fraudSignals: input.fraudSignals ?? {},
    historyScores,
    latestOverallScore: scored.overallScore,
  });

  const status = fraudFinal.suggestedStatus;
  const signalsJson = {
    ...(input.signals ?? {}),
    fraud: input.fraudSignals ?? {},
    factors: scored.factors,
    fraudReasons: fraudFinal.reasons,
  } as Prisma.InputJsonValue;

  const profile = existing
    ? await prisma.reputationProfile.update({
        where: { id: existing.id },
        data: {
          label: input.label ?? existing.label,
          status,
          trustScore: scored.trustScore,
          contributionScore: scored.contributionScore,
          fraudScore: fraudFinal.fraudScore,
          overallScore: scored.overallScore,
          signalsJson,
          lastScoredAt: new Date(),
          updatedById: input.updatedById ?? null,
        },
      })
    : await prisma.reputationProfile.create({
        data: {
          organizationId: input.organizationId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          label: input.label ?? null,
          status,
          trustScore: scored.trustScore,
          contributionScore: scored.contributionScore,
          fraudScore: fraudFinal.fraudScore,
          overallScore: scored.overallScore,
          signalsJson,
          lastScoredAt: new Date(),
          updatedById: input.updatedById ?? null,
        },
      });

  await prisma.reputationHistoryEvent.create({
    data: {
      organizationId: input.organizationId,
      profileId: profile.id,
      trustScore: scored.trustScore,
      contributionScore: scored.contributionScore,
      fraudScore: fraudFinal.fraudScore,
      overallScore: scored.overallScore,
      reason: input.reason ?? "score_recalculation",
      metaJson: {
        factors: scored.factors,
        fraudReasons: fraudFinal.reasons,
        anomaly: fraudFinal.anomaly,
      } as Prisma.InputJsonValue,
    },
  });

  let alert = null;
  if (fraudFinal.flagged && fraudFinal.severity) {
    alert = await prisma.reputationAlert.create({
      data: {
        organizationId: input.organizationId,
        profileId: profile.id,
        severity: fraudFinal.severity,
        status: ReputationAlertStatuses.open,
        alertType: fraudFinal.reasons[0] ?? "fraud_risk",
        title: buildAlertTitle(fraudFinal.reasons),
        detail: `Fraud score ${fraudFinal.fraudScore}; reasons: ${fraudFinal.reasons.join(", ") || "n/a"}`,
        scoreSnapshot: scored.overallScore,
      },
    });
  }

  return {
    profile: toPublicProfile(profile),
    breakdown: scored,
    fraud: fraudFinal,
    alert: alert
      ? {
          id: alert.id,
          severity: alert.severity,
          title: alert.title,
          status: alert.status,
        }
      : null,
  };
}

export async function patchReputation(
  id: string,
  input: {
    label?: string | null;
    status?: string;
    manualAdjustment?: number;
    reason?: string;
    updatedById?: string | null;
  },
) {
  const existing = await prisma.reputationProfile.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Reputation profile not found");

  const prevSignals =
    existing.signalsJson && typeof existing.signalsJson === "object"
      ? (existing.signalsJson as Record<string, unknown>)
      : {};

  if (input.manualAdjustment !== undefined) {
    const signals: ReputationSignals = {
      verificationRate: Number(prevSignals.verificationRate ?? 0.5),
      activityVolume: Number(prevSignals.activityVolume ?? 0),
      peerRating: Number(prevSignals.peerRating ?? 0.5),
      longevity: Number(prevSignals.longevity ?? 0.4),
      incidentRate: Number(prevSignals.incidentRate ?? 0),
      manualAdjustment: input.manualAdjustment,
    };
    return scoreSubject({
      organizationId: existing.organizationId,
      subjectType: existing.subjectType,
      subjectId: existing.subjectId,
      label: input.label === undefined ? existing.label ?? undefined : input.label ?? undefined,
      signals,
      fraudSignals: (prevSignals.fraud as FraudSignals) ?? {},
      reason: input.reason ?? "manual_adjustment",
      updatedById: input.updatedById,
    });
  }

  const profile = await prisma.reputationProfile.update({
    where: { id },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedById: input.updatedById ?? null,
    },
  });

  if (input.status || input.label !== undefined) {
    await prisma.reputationHistoryEvent.create({
      data: {
        organizationId: profile.organizationId,
        profileId: profile.id,
        trustScore: profile.trustScore,
        contributionScore: profile.contributionScore,
        fraudScore: profile.fraudScore,
        overallScore: profile.overallScore,
        reason: input.reason ?? "profile_patch",
        metaJson: { status: input.status, label: input.label } as Prisma.InputJsonValue,
      },
    });
  }

  return { profile: toPublicProfile(profile), breakdown: null, fraud: null, alert: null };
}

export async function listHistory(query: {
  organizationId: string;
  profileId?: string;
  subjectType?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.ReputationHistoryEventWhereInput = {
    organizationId: query.organizationId,
    ...(query.profileId ? { profileId: query.profileId } : {}),
    ...(query.subjectType ? { profile: { subjectType: query.subjectType } } : {}),
  };

  const [events, total] = await Promise.all([
    prisma.reputationHistoryEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
      include: {
        profile: {
          select: { subjectType: true, subjectId: true, label: true },
        },
      },
    }),
    prisma.reputationHistoryEvent.count({ where }),
  ]);

  const chronological = [...events].reverse().map((e) => e.overallScore);
  const trend = calculateHistoricalTrend(chronological);

  return {
    events: events.map((e) => ({
      id: e.id,
      profileId: e.profileId,
      subjectType: e.profile.subjectType,
      subjectId: e.profile.subjectId,
      label: e.profile.label,
      trustScore: e.trustScore,
      contributionScore: e.contributionScore,
      fraudScore: e.fraudScore,
      overallScore: e.overallScore,
      reason: e.reason,
      meta: e.metaJson,
      createdAt: e.createdAt.toISOString(),
    })),
    trend,
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function listAlerts(query: {
  organizationId: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.ReputationAlertWhereInput = {
    organizationId: query.organizationId,
    ...(query.status ? { status: query.status } : {}),
  };
  const [alerts, total] = await Promise.all([
    prisma.reputationAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
      include: {
        profile: {
          select: { subjectType: true, subjectId: true, label: true, overallScore: true },
        },
      },
    }),
    prisma.reputationAlert.count({ where }),
  ]);

  return {
    alerts: alerts.map((a) => ({
      id: a.id,
      profileId: a.profileId,
      severity: a.severity,
      status: a.status,
      alertType: a.alertType,
      title: a.title,
      detail: a.detail,
      scoreSnapshot: a.scoreSnapshot,
      subjectType: a.profile?.subjectType ?? null,
      subjectId: a.profile?.subjectId ?? null,
      label: a.profile?.label ?? null,
      createdAt: a.createdAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
    })),
    counts: {
      open: await prisma.reputationAlert.count({
        where: {
          organizationId: query.organizationId,
          status: ReputationAlertStatuses.open,
        },
      }),
      critical: await prisma.reputationAlert.count({
        where: {
          organizationId: query.organizationId,
          status: ReputationAlertStatuses.open,
          severity: ReputationAlertSeverities.critical,
        },
      }),
    },
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getLeaderboard(query: {
  organizationId: string;
  subjectType?: string;
  limit: number;
}) {
  const profiles = await prisma.reputationProfile.findMany({
    where: {
      organizationId: query.organizationId,
      ...(query.subjectType ? { subjectType: query.subjectType } : {}),
    },
    select: {
      id: true,
      subjectType: true,
      subjectId: true,
      label: true,
      overallScore: true,
      trustScore: true,
      status: true,
    },
  });

  return {
    organizationId: query.organizationId,
    subjectType: query.subjectType ?? null,
    leaderboard: buildLeaderboard(profiles, {
      subjectType: query.subjectType,
      limit: query.limit,
    }),
  };
}

export async function getProfileOrganizationId(id: string): Promise<string | null> {
  const row = await prisma.reputationProfile.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  return row?.organizationId ?? null;
}
