import { CertificateBulkJobStatuses, CertificateEventTypes } from "@trustchain/config";
import { prisma } from "@trustchain/database";

export type CertificateRetentionPolicy = {
  /** Old certificate events older than this are deleted. */
  eventDays: number;
  /** Terminal bulk jobs older than this are deleted. */
  bulkJobDays: number;
  /** Download/render/reprocess diagnostic events older than this. */
  temporaryAssetEventDays: number;
};

export const DEFAULT_CERTIFICATE_RETENTION_POLICY: CertificateRetentionPolicy = {
  eventDays: Number.parseInt(process.env.CERTIFICATE_EVENT_RETENTION_DAYS ?? "365", 10) || 365,
  bulkJobDays: Number.parseInt(process.env.CERTIFICATE_BULK_JOB_RETENTION_DAYS ?? "90", 10) || 90,
  temporaryAssetEventDays:
    Number.parseInt(process.env.CERTIFICATE_TEMP_ASSET_EVENT_DAYS ?? "30", 10) || 30,
};

export type CertificateRetentionResult = {
  deletedEvents: number;
  deletedBulkJobs: number;
  deletedTemporaryAssetEvents: number;
  cutoffs: {
    events: string;
    bulkJobs: string;
    temporaryAssets: string;
  };
  policy: CertificateRetentionPolicy;
};

export function retentionCutoff(days: number, now = new Date()): Date {
  const ms = Math.max(1, days) * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms);
}

const TEMP_EVENT_TYPES = [
  CertificateEventTypes.downloaded,
  CertificateEventTypes.rendered,
  CertificateEventTypes.reprocessed,
];

const TERMINAL_BULK = [
  CertificateBulkJobStatuses.completed,
  CertificateBulkJobStatuses.failed,
  CertificateBulkJobStatuses.cancelled,
] as const;

export async function previewCertificateRetention(
  organizationId: string,
  policy: CertificateRetentionPolicy = DEFAULT_CERTIFICATE_RETENTION_POLICY,
  now = new Date(),
) {
  const eventCutoff = retentionCutoff(policy.eventDays, now);
  const bulkCutoff = retentionCutoff(policy.bulkJobDays, now);
  const tempCutoff = retentionCutoff(policy.temporaryAssetEventDays, now);

  const [eventsEligible, bulkEligible, tempEligible] = await Promise.all([
    prisma.certificateEvent.count({
      where: { organizationId, createdAt: { lte: eventCutoff } },
    }),
    prisma.certificateBulkJob.count({
      where: {
        organizationId,
        status: { in: [...TERMINAL_BULK] },
        OR: [{ completedAt: { lte: bulkCutoff } }, { completedAt: null, createdAt: { lte: bulkCutoff } }],
      },
    }),
    prisma.certificateEvent.count({
      where: {
        organizationId,
        eventType: { in: TEMP_EVENT_TYPES },
        createdAt: { lte: tempCutoff },
      },
    }),
  ]);

  return {
    organizationId,
    eventsEligible,
    bulkJobsEligible: bulkEligible,
    temporaryAssetEventsEligible: tempEligible,
    policy,
    cutoffs: {
      events: eventCutoff.toISOString(),
      bulkJobs: bulkCutoff.toISOString(),
      temporaryAssets: tempCutoff.toISOString(),
    },
  };
}

/**
 * Cleans old events, terminal bulk jobs, and short-lived download/render events.
 * Does not delete certificates themselves.
 */
export async function runCertificateRetentionCleanup(
  organizationId: string,
  policy: CertificateRetentionPolicy = DEFAULT_CERTIFICATE_RETENTION_POLICY,
  now = new Date(),
): Promise<CertificateRetentionResult> {
  const eventCutoff = retentionCutoff(policy.eventDays, now);
  const bulkCutoff = retentionCutoff(policy.bulkJobDays, now);
  const tempCutoff = retentionCutoff(policy.temporaryAssetEventDays, now);

  const deletedTemp = await prisma.certificateEvent.deleteMany({
    where: {
      organizationId,
      eventType: { in: TEMP_EVENT_TYPES },
      createdAt: { lte: tempCutoff },
    },
  });

  const deletedEvents = await prisma.certificateEvent.deleteMany({
    where: {
      organizationId,
      createdAt: { lte: eventCutoff },
    },
  });

  const deletedBulkJobs = await prisma.certificateBulkJob.deleteMany({
    where: {
      organizationId,
      status: { in: [...TERMINAL_BULK] },
      OR: [{ completedAt: { lte: bulkCutoff } }, { completedAt: null, createdAt: { lte: bulkCutoff } }],
    },
  });

  return {
    deletedEvents: deletedEvents.count,
    deletedBulkJobs: deletedBulkJobs.count,
    deletedTemporaryAssetEvents: deletedTemp.count,
    cutoffs: {
      events: eventCutoff.toISOString(),
      bulkJobs: bulkCutoff.toISOString(),
      temporaryAssets: tempCutoff.toISOString(),
    },
    policy,
  };
}
