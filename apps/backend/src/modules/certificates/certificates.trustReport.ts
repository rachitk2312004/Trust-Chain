import {
  CertificateEventTypes,
  CertificateStatuses,
  RoleKeys,
  VerificationOutcomes,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { assertOrgFeature } from "../billing/billing.entitlements.js";
import { BillingFeatureKeys } from "../billing/billing.plans.js";

const FLAGGED_OUTCOMES = [
  VerificationOutcomes.tampered,
  VerificationOutcomes.invalid,
  VerificationOutcomes.revoked,
] as const;

export function summarizeVerificationOutcomes(
  rows: Array<{ outcome: string }>,
): { byOutcome: Record<string, number>; flagged: number; total: number } {
  const byOutcome: Record<string, number> = {};
  for (const row of rows) {
    byOutcome[row.outcome] = (byOutcome[row.outcome] ?? 0) + 1;
  }
  const flagged = FLAGGED_OUTCOMES.reduce((sum, key) => sum + (byOutcome[key] ?? 0), 0);
  return { byOutcome, flagged, total: rows.length };
}

export function outcomeFromCertificateVerifyPayload(payload: unknown): {
  valid: boolean;
  outcome: string;
  reasons: string[];
  publicLookup: boolean;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, outcome: VerificationOutcomes.invalid, reasons: [], publicLookup: false };
  }
  const data = payload as {
    valid?: unknown;
    reasons?: unknown;
    public?: unknown;
    checks?: { integrity?: unknown };
  };
  const reasons = Array.isArray(data.reasons)
    ? data.reasons.filter((item): item is string => typeof item === "string")
    : [];
  const valid = data.valid === true;
  if (valid) {
    return { valid: true, outcome: VerificationOutcomes.valid, reasons, publicLookup: data.public === true };
  }
  if (reasons.includes("CERTIFICATE_REVOKED")) {
    return { valid: false, outcome: VerificationOutcomes.revoked, reasons, publicLookup: data.public === true };
  }
  if (reasons.includes("CERTIFICATE_EXPIRED")) {
    return { valid: false, outcome: VerificationOutcomes.expired, reasons, publicLookup: data.public === true };
  }
  if (
    reasons.includes("INTEGRITY_MISMATCH") ||
    reasons.includes("ARTIFACT_HASH_MISMATCH") ||
    reasons.includes("CHAIN_HASH_MISMATCH")
  ) {
    return { valid: false, outcome: VerificationOutcomes.tampered, reasons, publicLookup: data.public === true };
  }
  if (reasons.includes("ARTIFACT_MISSING") || reasons.includes("LINKED_DOCUMENT_UNAVAILABLE")) {
    return { valid: false, outcome: VerificationOutcomes.missing, reasons, publicLookup: data.public === true };
  }
  return { valid: false, outcome: VerificationOutcomes.invalid, reasons, publicLookup: data.public === true };
}

function displayName(user: {
  email: string;
  firstName: string | null;
  lastName: string | null;
} | null): string {
  if (!user) return "Public scan";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email;
}

export async function getCertificateTrustReport(userId: string, organizationId: string) {
  const allowed = await userHasRole(userId, [RoleKeys.superAdmin, RoleKeys.orgAdmin], organizationId);
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  await assertOrgFeature(userId, organizationId, BillingFeatureKeys.trustReports);

  const [certificateGroups, verificationRows, flaggedRows, recentIssues, certificateVerifyEvents] =
    await Promise.all([
      prisma.certificate.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.verificationResult.findMany({
        where: { organizationId },
        select: { outcome: true },
      }),
      prisma.verificationResult.findMany({
        where: { organizationId, outcome: { in: [...FLAGGED_OUTCOMES] } },
        include: {
          request: {
            select: {
              id: true,
              verificationCode: true,
              documentId: true,
              requestedBy: { select: { email: true, firstName: true, lastName: true } },
              document: { select: { title: true } },
            },
          },
        },
        orderBy: { verifiedAt: "desc" },
        take: 25,
      }),
      prisma.certificate.findMany({
        where: { organizationId, status: CertificateStatuses.issued },
        orderBy: { issuedAt: "desc" },
        take: 8,
        select: {
          id: true,
          publicId: true,
          title: true,
          issuedAt: true,
          recipientName: true,
          recipientEmail: true,
        },
      }),
      prisma.certificateEvent.findMany({
        where: { organizationId, eventType: CertificateEventTypes.verified },
        include: {
          certificate: { select: { id: true, publicId: true, title: true } },
          actor: { select: { email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const issuance: Record<string, number> = {};
  for (const row of certificateGroups) {
    issuance[row.status] = row._count._all;
  }

  const certificateOutcomes = certificateVerifyEvents.map((event) =>
    outcomeFromCertificateVerifyPayload(event.payloadJson),
  );
  const verification = summarizeVerificationOutcomes([
    ...verificationRows,
    ...certificateOutcomes.map((item) => ({ outcome: item.outcome })),
  ]);

  const certificateLookups = certificateOutcomes.length;
  const certificateLookupFailures = certificateOutcomes.filter((item) => !item.valid).length;
  const documentChecks = verificationRows.length;

  const flaggedCertificates = certificateVerifyEvents
    .map((event) => {
      const mapped = outcomeFromCertificateVerifyPayload(event.payloadJson);
      return { event, mapped };
    })
    .filter((row) => (FLAGGED_OUTCOMES as readonly string[]).includes(row.mapped.outcome))
    .slice(0, 25)
    .map(({ event, mapped }) => ({
      id: event.id,
      source: "certificate" as const,
      requestId: null,
      certificateId: event.certificate.id,
      verificationCode: event.certificate.publicId,
      publicId: event.certificate.publicId,
      outcome: mapped.outcome,
      title: event.certificate.title,
      documentTitle: event.certificate.title,
      requestedBy: displayName(event.actor),
      verifiedAt: event.createdAt.toISOString(),
      failureReasons: mapped.reasons,
      href: `/certificates/${event.certificate.id}`,
    }));

  const flaggedDocuments = flaggedRows.map((row) => ({
    id: row.id,
    source: "document" as const,
    requestId: row.requestId,
    certificateId: null,
    verificationCode: row.request.verificationCode,
    publicId: null,
    outcome: row.outcome,
    title: row.request.document?.title ?? row.request.verificationCode,
    documentTitle: row.request.document?.title ?? row.request.verificationCode,
    requestedBy:
      [row.request.requestedBy.firstName, row.request.requestedBy.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || row.request.requestedBy.email,
    verifiedAt: row.verifiedAt.toISOString(),
    failureReasons: row.failureReasons,
    href: `/verification/${row.requestId}`,
  }));

  const flaggedVerifications = [...flaggedCertificates, ...flaggedDocuments]
    .sort((a, b) => Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt))
    .slice(0, 25);

  const recentLookups = certificateVerifyEvents.slice(0, 8).map((event) => {
    const mapped = outcomeFromCertificateVerifyPayload(event.payloadJson);
    return {
      id: event.id,
      certificateId: event.certificate.id,
      publicId: event.certificate.publicId,
      title: event.certificate.title,
      outcome: mapped.outcome,
      valid: mapped.valid,
      publicLookup: mapped.publicLookup,
      requestedBy: displayName(event.actor),
      verifiedAt: event.createdAt.toISOString(),
      href: `/certificates/${event.certificate.id}`,
    };
  });

  return {
    report: {
      generatedAt: new Date().toISOString(),
      organizationId,
      issuance: {
        issued: issuance[CertificateStatuses.issued] ?? 0,
        draft: issuance[CertificateStatuses.draft] ?? 0,
        revoked: issuance[CertificateStatuses.revoked] ?? 0,
        expired: issuance[CertificateStatuses.expired] ?? 0,
        total: Object.values(issuance).reduce((sum, value) => sum + value, 0),
      },
      verification: {
        ...verification,
        fakeOrTampered: verification.byOutcome[VerificationOutcomes.tampered] ?? 0,
        valid: verification.byOutcome[VerificationOutcomes.valid] ?? 0,
        invalid: verification.byOutcome[VerificationOutcomes.invalid] ?? 0,
        revoked: verification.byOutcome[VerificationOutcomes.revoked] ?? 0,
        expired: verification.byOutcome[VerificationOutcomes.expired] ?? 0,
        missing: verification.byOutcome[VerificationOutcomes.missing] ?? 0,
        documentChecks,
        certificateLookups,
        certificateLookupFailures,
      },
      flaggedVerifications,
      recentLookups,
      recentIssues: recentIssues.map((row) => ({
        id: row.id,
        publicId: row.publicId,
        title: row.title,
        recipientName: row.recipientName,
        recipientEmail: row.recipientEmail,
        issuedAt: row.issuedAt?.toISOString() ?? null,
      })),
    },
  };
}
