import {
  CertificateEventTypes,
  CertificateStatuses,
  CertificateTemplateStatuses,
  DeveloperEventTypes,
  DocumentPermissions,
  NotificationEventTypes,
  RoleKeys,
} from "@trustchain/config";
import { prisma, Prisma, type Prisma as PrismaTypes } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import {
  assertOrgFeature,
  consumeOrgMetric,
} from "../billing/billing.entitlements.js";
import { BillingFeatureKeys, BillingMetricKeys } from "../billing/billing.plans.js";
import { findUserByEmail, findUserById } from "../auth/users.repository.js";
import { publishDeveloperEventSafe } from "../developer/developer.delivery.js";
import { assertDocumentPermission } from "../documents/documents.access.js";
import { emitDomainNotification } from "../notifications/notification.emit.js";
import { generateCertificateIdentity } from "./certificates.generator.js";
import * as repo from "./certificates.repository.js";
import {
  createTemplate,
  defaultCertificateLayout,
  findTemplateById,
  listTemplates,
  toPublicTemplate,
  updateTemplate,
} from "./certificates.templates.js";
import { resolveCertificateLayout } from "./certificates.layout.js";
import { loadCertificateAssets } from "./certificates.assets.js";
import {
  exportCertificate,
  type CertificateExportFormat,
} from "./certificates.export.js";
import { evaluateCertificateTrust } from "./certificates.trust.js";
import { certificateProcessMetrics } from "./certificates.observability.js";
import {
  notifyCertificateIssuedToHolder,
  notifyCertificateIssuedToStaff,
  notifyCertificateRevokedToHolder,
} from "./certificate.notifications.js";
import {
  auditCertificateIssued,
  auditCertificateRevoked,
  indexCertificateSearch,
} from "./certificate.audit.js";

async function assertOrgStaff(userId: string, organizationId: string) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
}

async function assertOrgAdmin(userId: string, organizationId: string) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Organization admin role required");
}

function asMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

const RECIPIENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicRecipientUser(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email,
  };
}

export async function lookupCertificateRecipients(
  userId: string,
  organizationId: string,
  q: string,
) {
  await assertOrgStaff(userId, organizationId);
  const query = q.trim();
  if (query.length < 2) {
    return { query, exact: null, matches: [] as ReturnType<typeof publicRecipientUser>[] };
  }

  const emailQuery = RECIPIENT_EMAIL_RE.test(query) ? query.toLowerCase() : null;
  let exact: {
    exists: boolean;
    user: ReturnType<typeof publicRecipientUser> | null;
    inOrganization: boolean;
    membershipStatus: string | null;
  } | null = null;

  if (emailQuery) {
    const user = await findUserByEmail(emailQuery);
    if (!user) {
      exact = { exists: false, user: null, inOrganization: false, membershipStatus: null };
    } else {
      const membership = await prisma.membership.findFirst({
        where: { organizationId, userId: user.id },
        select: { status: true },
      });
      exact = {
        exists: true,
        user: publicRecipientUser({
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
        }),
        inOrganization: Boolean(membership),
        membershipStatus: membership?.status ?? null,
      };
    }
  }

  const nameFilter = {
    deletedAt: null,
    OR: [
      { email: { contains: query, mode: "insensitive" as const } },
      { firstName: { contains: query, mode: "insensitive" as const } },
      { lastName: { contains: query, mode: "insensitive" as const } },
    ],
  };

  const [memberRows, requestRows] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId, user: nameFilter },
      take: 8,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.membershipRequest.findMany({
      where: { organizationId, user: nameFilter },
      take: 8,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  const seen = new Set<string>();
  const matches: Array<
    ReturnType<typeof publicRecipientUser> & {
      inOrganization: boolean;
      membershipStatus: string | null;
    }
  > = [];

  function addMatch(
    user: { id: string; email: string; firstName: string | null; lastName: string | null },
    inOrganization: boolean,
    membershipStatus: string | null,
  ) {
    if (seen.has(user.id)) return;
    seen.add(user.id);
    matches.push({ ...publicRecipientUser(user), inOrganization, membershipStatus });
  }

  if (exact?.user) {
    addMatch(exact.user, exact.inOrganization, exact.membershipStatus);
  }
  for (const row of memberRows) {
    addMatch(row.user, true, row.status);
  }
  for (const row of requestRows) {
    addMatch(row.user, false, row.status);
  }

  return { query, exact, matches: matches.slice(0, 8) };
}

export async function createCertificateTemplate(
  userId: string,
  input: {
    organizationId: string;
    code: string;
    name: string;
    description?: string | null;
    layout?: Record<string, unknown>;
  },
) {
  await assertOrgAdmin(userId, input.organizationId);
  await assertOrgFeature(userId, input.organizationId, BillingFeatureKeys.certificateTemplates);
  try {
    const row = await createTemplate({
      organizationId: input.organizationId,
      code: input.code.toLowerCase(),
      name: input.name,
      description: input.description,
      layoutJson: (input.layout ?? defaultCertificateLayout()) as PrismaTypes.InputJsonValue,
      createdById: userId,
    });
    return { template: toPublicTemplate(row) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "TEMPLATE_CODE_EXISTS", "Template code already exists");
    }
    throw error;
  }
}

export async function listCertificateTemplates(
  userId: string,
  organizationId: string,
  status?: string,
) {
  await assertOrgStaff(userId, organizationId);
  const rows = await listTemplates(organizationId, status);
  return { templates: rows.map(toPublicTemplate) };
}

export async function getCertificateTemplate(
  userId: string,
  organizationId: string,
  templateId: string,
) {
  await assertOrgStaff(userId, organizationId);
  const row = await findTemplateById(organizationId, templateId);
  if (!row) throw new AppError(404, "TEMPLATE_NOT_FOUND", "Certificate template not found");
  return { template: toPublicTemplate(row) };
}

export async function patchCertificateTemplate(
  userId: string,
  organizationId: string,
  templateId: string,
  input: {
    name?: string;
    description?: string | null;
    layout?: Record<string, unknown>;
    status?: string;
  },
) {
  await assertOrgAdmin(userId, organizationId);
  await assertOrgFeature(userId, organizationId, BillingFeatureKeys.certificateTemplates);
  const existing = await findTemplateById(organizationId, templateId);
  if (!existing) throw new AppError(404, "TEMPLATE_NOT_FOUND", "Certificate template not found");
  if (input.status && input.status !== CertificateTemplateStatuses.active && input.status !== CertificateTemplateStatuses.archived) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid template status");
  }
  const row = await updateTemplate(templateId, {
    name: input.name,
    description: input.description,
    layoutJson: input.layout as PrismaTypes.InputJsonValue | undefined,
    status: input.status,
  });
  return { template: toPublicTemplate(row) };
}

export async function previewCertificateTemplate(
  userId: string,
  input: {
    organizationId: string;
    templateId?: string | null;
    layout?: Record<string, unknown>;
    title?: string;
    recipientName?: string;
  },
) {
  await assertOrgStaff(userId, input.organizationId);

  let layoutJson: unknown = input.layout ?? defaultCertificateLayout();
  if (input.templateId && !input.layout) {
    const template = await findTemplateById(input.organizationId, input.templateId);
    if (!template) throw new AppError(404, "TEMPLATE_NOT_FOUND", "Certificate template not found");
    layoutJson = template.layoutJson;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { name: true },
  });
  if (!organization) throw new AppError(404, "ORG_NOT_FOUND", "Organization not found");

  const layout = resolveCertificateLayout(layoutJson);
  const branding = await prisma.organizationBranding.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (branding?.primaryColor) layout.accentColor = branding.primaryColor;
  if (branding?.secondaryColor) layout.borderColor = branding.secondaryColor;

  const title = input.title?.trim() || "Certificate of Achievement";
  const recipientName = input.recipientName?.trim() || "Sample Recipient";
  const { getPublicAppUrl } = await import("../../lib/appUrls.js");
  const verificationUrl = `${getPublicAppUrl()}/certificates/verify/CERT-PREVIEW`;

  const assets = await loadCertificateAssets({
    organizationId: input.organizationId,
    verificationUrl,
    qrPublicCode: null,
    logoObjectKey: layout.logoObjectKey,
    signatureImageKey: layout.signatureImageKey,
    backgroundImageKey: layout.backgroundImageKey,
    showQr: layout.showQr,
    showLogo: layout.showLogo,
    showSignature: layout.showSignature,
  });

  return exportCertificate(
    {
      publicId: "CERT-PREVIEW",
      title,
      recipientName,
      organizationName: branding?.displayName || organization.name,
      issuedAt: new Date(),
      expiresAt: null,
      verificationUrl,
      qrPublicCode: null,
      metadata: { preview: true },
      layout,
      assets,
      branding: {
        primaryColor: branding?.primaryColor,
        secondaryColor: branding?.secondaryColor,
        displayName: branding?.displayName,
      },
    },
    "png",
    "CERT-PREVIEW",
  );
}

export async function issueCertificate(
  userId: string,
  input: {
    organizationId: string;
    title: string;
    description?: string | null;
    recipientName: string;
    recipientEmail?: string | null;
    recipientUserId?: string | null;
    templateId?: string | null;
    documentId?: string | null;
    expiresAt?: string | null;
    issuedAt?: string | null;
    publicId?: string | null;
    metadata?: Record<string, unknown>;
    createQr?: boolean;
    publishToChain?: boolean;
  },
) {
  await assertOrgStaff(userId, input.organizationId);
  await consumeOrgMetric(
    userId,
    input.organizationId,
    BillingMetricKeys.certificateIssues,
    1,
    BillingFeatureKeys.issueCertificates,
  );

  let templateId: string | null = input.templateId ?? null;
  if (templateId) {
    const template = await findTemplateById(input.organizationId, templateId);
    if (!template || template.status !== CertificateTemplateStatuses.active) {
      throw new AppError(404, "TEMPLATE_NOT_FOUND", "Active certificate template not found");
    }
  }

  if (input.publicId) {
    const existing = await prisma.certificate.findFirst({
      where: { publicId: input.publicId },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, "CERTIFICATE_ID_EXISTS", "Certificate identifier already exists");
    }
  }

  let documentContentHash: string | null = null;
  let documentId: string | null = input.documentId ?? null;
  if (documentId) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId: input.organizationId },
      include: { currentVersion: true },
    });
    if (!document || document.deletedAt) {
      throw new AppError(404, "DOC_NOT_FOUND", "Document not found");
    }
    await assertDocumentPermission(
      userId,
      {
        id: document.id,
        organizationId: document.organizationId,
        createdById: document.createdById,
        status: document.status,
        deletedAt: document.deletedAt,
        expiresAt: document.expiresAt,
        archivedAt: document.archivedAt,
      },
      DocumentPermissions.view,
    );
    documentContentHash = document.currentVersion?.contentHash ?? null;
  }

  const issuedAt = input.issuedAt ? new Date(input.issuedAt) : new Date();
  if (Number.isNaN(issuedAt.getTime())) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid issue date");
  }
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid expiration date");
  }

  if (!documentId) {
    const { ensureCertificateBackingDocument } = await import("./certificates.publish.js");
    documentId = await ensureCertificateBackingDocument({
      userId,
      organizationId: input.organizationId,
      title: input.title,
      description: input.description,
      expiresAt,
    });
  }

  const recipientEmail = input.recipientEmail?.trim().toLowerCase() || null;
  let recipientUserId = input.recipientUserId ?? null;
  if (!recipientUserId && recipientEmail) {
    const recipient = await findUserByEmail(recipientEmail);
    if (recipient) recipientUserId = recipient.id;
  }

  const metadata = {
    ...(input.metadata ?? {}),
    ...(documentContentHash ? { documentContentHash } : {}),
  };

  const identity = generateCertificateIdentity({
    organizationId: input.organizationId,
    title: input.title,
    recipientName: input.recipientName,
    recipientEmail,
    issuedAt,
    expiresAt,
    templateId,
    documentId,
    metadata,
    publicId: input.publicId,
  });

  const certificate = await repo.createCertificate({
    publicId: identity.publicId,
    organization: { connect: { id: input.organizationId } },
    ...(templateId ? { template: { connect: { id: templateId } } } : {}),
    ...(documentId ? { document: { connect: { id: documentId } } } : {}),
    title: input.title,
    description: input.description ?? null,
    recipientName: input.recipientName,
    recipientEmail,
    recipientUserId: recipientUserId,
    status: CertificateStatuses.issued,
    issuedAt,
    expiresAt,
    metadataJson: metadata as PrismaTypes.InputJsonValue,
    integrityHash: identity.integrityHash,
    verificationUrl: identity.verificationUrl,
    qrPublicCode: null,
    issuedBy: { connect: { id: userId } },
    events: {
      create: {
        organizationId: input.organizationId,
        eventType: CertificateEventTypes.issued,
        actorId: userId,
        payloadJson: {
          publicId: identity.publicId,
          documentId,
          qrPublicCode: null,
        },
      },
    },
  });

  const createQr = input.createQr !== false;
  const publishToChain = input.publishToChain !== false;

  void finishIssuedCertificate(userId, certificate, {
    createQr,
    publishToChain,
  });

  return {
    certificate: repo.toPublicCertificate(certificate),
    chain: {
      enabled: publishToChain,
      registered: false,
      status: publishToChain ? "pending" : null,
      contentHash: null,
      txHash: null,
      explorerUrl: null,
      skipped: !publishToChain,
      reason: publishToChain ? "PUBLISH_IN_PROGRESS" : null,
    },
  };
}

async function finishIssuedCertificate(
  userId: string,
  certificate: {
    id: string;
    organizationId: string;
    publicId: string;
    title: string;
    description: string | null;
    recipientName: string;
    recipientEmail: string | null;
    status: string;
    createdAt: Date;
  },
  options: { createQr: boolean; publishToChain: boolean },
) {
  try {
    const { finalizeIssuedCertificate } = await import("./certificates.publish.js");
    const published = await finalizeIssuedCertificate(
      userId,
      certificate.id,
      certificate.organizationId,
      options,
    );
    const issued = published.certificate;

    await notifyCertificateIssuedToStaff({
      organizationId: certificate.organizationId,
      actorId: userId,
      certificateId: issued.id,
      publicId: issued.publicId,
      recipientName: issued.recipient.name,
    });
    await notifyCertificateIssuedToHolder({
      organizationId: certificate.organizationId,
      actorId: userId,
      certificateId: issued.id,
      publicId: issued.publicId,
      title: issued.title,
      recipientName: issued.recipient.name,
      recipientEmail: issued.recipient.email,
      recipientUserId: issued.recipient.userId,
      verificationUrl: issued.verificationUrl,
    });
    await auditCertificateIssued({ actorUserId: userId, certificate });
    await indexCertificateSearch(certificate);
    publishDeveloperEventSafe({
      organizationId: certificate.organizationId,
      eventType: DeveloperEventTypes.certificateCreated,
      data: {
        certificateId: issued.id,
        publicId: issued.publicId,
        documentId: issued.documentId,
        status: issued.status,
        chain: published.chain,
      },
    });
  } catch (error) {
    console.error("[certificates] post-issue work failed", {
      certificateId: certificate.id,
      error,
    });
  }
}

export async function listCertificates(
  userId: string,
  organizationId: string,
  query: { status?: string; limit: number; offset: number },
) {
  await assertOrgStaff(userId, organizationId);
  const { issuedByFilterForScope } = await import("../organizations/orgPlacement.js");
  const scopeFilter = await issuedByFilterForScope(userId, organizationId);
  const result = await repo.listCertificates(organizationId, { ...query, ...scopeFilter });
  return {
    certificates: result.items.map(repo.toPublicCertificate),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function getCertificate(
  userId: string,
  organizationId: string,
  certificateId: string,
) {
  await assertOrgStaff(userId, organizationId);
  const row = await repo.findCertificateById(organizationId, certificateId);
  if (!row) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  const { assertIssuedWorkVisible } = await import("../organizations/orgPlacement.js");
  await assertIssuedWorkVisible(userId, organizationId, row.issuedById);
  return { certificate: repo.toPublicCertificate(row) };
}

export async function getCertificateHistory(
  userId: string,
  organizationId: string,
  certificateId: string,
  query: { limit: number; offset: number },
) {
  await assertOrgStaff(userId, organizationId);
  const row = await repo.findCertificateById(organizationId, certificateId);
  if (!row) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  const { assertIssuedWorkVisible } = await import("../organizations/orgPlacement.js");
  await assertIssuedWorkVisible(userId, organizationId, row.issuedById);
  const events = await repo.listCertificateEvents(certificateId, query.limit, query.offset);
  return {
    certificateId,
    events: events.items.map(repo.toPublicEvent),
    total: events.total,
    limit: events.limit,
    offset: events.offset,
  };
}

export async function revokeCertificate(
  userId: string,
  organizationId: string,
  certificateId: string,
  reason?: string,
) {
  await assertOrgAdmin(userId, organizationId);
  const existing = await repo.findCertificateById(organizationId, certificateId);
  if (!existing) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  if (existing.status === CertificateStatuses.revoked) {
    return { certificate: repo.toPublicCertificate(existing) };
  }

  const updated = await repo.updateCertificate(certificateId, {
    status: CertificateStatuses.revoked,
    revokedAt: new Date(),
    revokedBy: { connect: { id: userId } },
    revokeReason: reason ?? null,
    events: {
      create: {
        organizationId,
        eventType: CertificateEventTypes.revoked,
        actorId: userId,
        payloadJson: { reason: reason ?? null },
      },
    },
  });

  if (existing.qrPublicCode) {
    try {
      const { revokeQr } = await import("../qr/services/qr.service.js");
      await revokeQr(userId, organizationId, existing.qrPublicCode);
    } catch (error) {
      console.error("[certificates] linked QR revoke failed", error);
    }
  }

  const { revokeCertificateOnChainSafe } = await import("./certificates.publish.js");
  await revokeCertificateOnChainSafe(userId, organizationId, existing.documentId);

  await notifyCertificateRevokedToHolder({
    organizationId,
    actorId: userId,
    certificateId: updated.id,
    publicId: updated.publicId,
    title: updated.title,
    recipientName: updated.recipientName,
    recipientEmail: updated.recipientEmail,
    recipientUserId: updated.recipientUserId,
    verificationUrl: updated.verificationUrl,
    revokeReason: reason ?? null,
  });

  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.certificateRevoked,
    entityId: updated.id,
    entityType: "certificate",
    title: "Certificate revoked",
    message: `Certificate ${updated.publicId} was revoked.`,
    metadata: { publicId: updated.publicId, reason: reason ?? null },
    recipientUserIds: [userId],
  });

  await auditCertificateRevoked({
    actorUserId: userId,
    certificate: updated,
    reason: reason ?? null,
  });
  await indexCertificateSearch(updated);

  publishDeveloperEventSafe({
    organizationId,
    eventType: DeveloperEventTypes.certificateRevoked,
    data: {
      certificateId: updated.id,
      publicId: updated.publicId,
      reason: reason ?? null,
    },
  });

  return { certificate: repo.toPublicCertificate(updated) };
}

export async function verifyCertificateById(
  userId: string,
  organizationId: string | undefined,
  certificateId: string,
) {
  const row = organizationId
    ? await repo.findCertificateById(organizationId, certificateId)
    : await prisma.certificate.findFirst({
        where: { id: certificateId },
        include: {
          document: { select: { id: true, status: true, deletedAt: true, title: true } },
        },
      });

  if (!row) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  await assertOrgStaff(userId, row.organizationId);
  const { assertIssuedWorkVisible } = await import("../organizations/orgPlacement.js");
  await assertIssuedWorkVisible(userId, row.organizationId, row.issuedById);

  // Mark expired lazily for verification reporting.
  let status = row.status;
  if (
    status === CertificateStatuses.issued &&
    row.expiresAt &&
    row.expiresAt.getTime() <= Date.now()
  ) {
    status = CertificateStatuses.expired;
  }

  const verifyStarted = Date.now();
  const { verification: result, chain } = await evaluateCertificateTrust({
    publicId: row.publicId,
    organizationId: row.organizationId,
    title: row.title,
    recipientName: row.recipientName,
    recipientEmail: row.recipientEmail,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    templateId: row.templateId,
    documentId: row.documentId,
    metadata: asMetadata(row.metadataJson),
    integrityHash: row.integrityHash,
    status,
    qrPublicCode: row.qrPublicCode,
    documentStatus: row.document?.status ?? null,
    documentDeletedAt: row.document?.deletedAt ?? null,
  });
  const verifyMs = Date.now() - verifyStarted;
  certificateProcessMetrics.recordVerification(verifyMs);

  await repo.createCertificateEvent({
    certificateId: row.id,
    organizationId: row.organizationId,
    eventType: CertificateEventTypes.verified,
    actorId: userId,
    payloadJson: {
      valid: result.valid,
      reasons: result.reasons,
      checks: result.checks,
      durationMs: verifyMs,
      chain,
    },
  });

  return {
    certificate: repo.toPublicCertificate({ ...row, status }),
    verification: result,
    chain,
  };
}

export async function listMyCertificates(
  userId: string,
  query: { status?: string; limit: number; offset: number },
) {
  const user = await findUserById(userId);
  const { claimCertificatesForUser } = await import("./certificates.claim.js");
  await claimCertificatesForUser(userId, user?.email);
  const result = await repo.listCertificatesForRecipient(userId, {
    ...query,
    email: user?.email,
  });
  return {
    certificates: result.items.map(repo.toPublicCertificate),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function getMyCertificate(userId: string, certificateId: string) {
  const user = await findUserById(userId);
  const { claimCertificatesForUser } = await import("./certificates.claim.js");
  await claimCertificatesForUser(userId, user?.email);
  const row = await repo.findCertificateForRecipient(userId, certificateId, user?.email);
  if (!row) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  return { certificate: repo.toPublicCertificate(row) };
}

type CertificateRowForExport = NonNullable<Awaited<ReturnType<typeof repo.findCertificateById>>>;

async function renderCertificateDownload(
  userId: string,
  row: CertificateRowForExport,
  format: CertificateExportFormat,
) {
  const organizationId = row.organizationId;
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  if (!organization) throw new AppError(404, "ORG_NOT_FOUND", "Organization not found");

  let layoutJson: unknown = defaultCertificateLayout();
  if (row.templateId) {
    const template = await findTemplateById(organizationId, row.templateId);
    if (!template) {
      throw new AppError(404, "TEMPLATE_NOT_FOUND", "Certificate template not found");
    }
    layoutJson = template.layoutJson;
  }

  const layout = resolveCertificateLayout(layoutJson);
  const branding = await prisma.organizationBranding.findUnique({
    where: { organizationId },
  });

  if (branding?.primaryColor) layout.accentColor = branding.primaryColor;
  if (branding?.secondaryColor) layout.borderColor = branding.secondaryColor;

  const assets = await loadCertificateAssets({
    organizationId,
    verificationUrl: row.verificationUrl,
    qrPublicCode: row.qrPublicCode,
    logoObjectKey: layout.logoObjectKey,
    signatureImageKey: layout.signatureImageKey,
    backgroundImageKey: layout.backgroundImageKey,
    showQr: layout.showQr,
    showLogo: layout.showLogo,
    showSignature: layout.showSignature,
  });

  const renderStarted = Date.now();
  let exported;
  try {
    exported = await exportCertificate(
      {
        publicId: row.publicId,
        title: row.title,
        recipientName: row.recipientName,
        organizationName: branding?.displayName || organization.name,
        issuedAt: row.issuedAt,
        expiresAt: row.expiresAt,
        verificationUrl: row.verificationUrl,
        qrPublicCode: row.qrPublicCode,
        metadata: asMetadata(row.metadataJson),
        layout,
        assets,
        branding: {
          primaryColor: branding?.primaryColor,
          secondaryColor: branding?.secondaryColor,
          displayName: branding?.displayName,
        },
      },
      format,
      row.publicId,
    );
  } catch (error) {
    certificateProcessMetrics.recordRender(Date.now() - renderStarted, false);
    throw error;
  }

  const durationMs = Date.now() - renderStarted;
  certificateProcessMetrics.recordDownload(format, durationMs);

  await repo.createCertificateEvent({
    certificateId: row.id,
    organizationId,
    eventType: CertificateEventTypes.downloaded,
    actorId: userId,
    payloadJson: {
      format,
      durationMs,
      warnings: exported.warnings,
      fileName: exported.fileName,
    },
  });
  await repo.createCertificateEvent({
    certificateId: row.id,
    organizationId,
    eventType: CertificateEventTypes.rendered,
    actorId: userId,
    payloadJson: { format, durationMs },
  });

  return exported;
}

export async function downloadMyCertificateExport(
  userId: string,
  certificateId: string,
  format: CertificateExportFormat,
) {
  const user = await findUserById(userId);
  const { claimCertificatesForUser } = await import("./certificates.claim.js");
  await claimCertificatesForUser(userId, user?.email);
  const row = await repo.findCertificateForRecipient(userId, certificateId, user?.email);
  if (!row) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  return renderCertificateDownload(userId, row, format);
}

export async function downloadCertificateExport(
  userId: string,
  organizationId: string,
  certificateId: string,
  format: CertificateExportFormat,
) {
  await assertOrgStaff(userId, organizationId);
  const row = await repo.findCertificateById(organizationId, certificateId);
  if (!row) throw new AppError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  const { assertIssuedWorkVisible } = await import("../organizations/orgPlacement.js");
  await assertIssuedWorkVisible(userId, organizationId, row.issuedById);

  return renderCertificateDownload(userId, row, format);
}

export async function getCertificateAnalyticsOverview(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  await assertOrgFeature(userId, organizationId, BillingFeatureKeys.analytics);
  const { generateCertificateAnalytics } = await import("./certificates.analytics.js");
  return { analytics: await generateCertificateAnalytics(organizationId) };
}

export async function getCertificateTemplateAnalytics(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  await assertOrgFeature(userId, organizationId, BillingFeatureKeys.analytics);
  const { getTemplateAnalytics } = await import("./certificates.analytics.js");
  return getTemplateAnalytics(organizationId);
}

export async function getCertificateIssuanceAnalytics(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  await assertOrgFeature(userId, organizationId, BillingFeatureKeys.analytics);
  const { getIssuanceAnalytics } = await import("./certificates.analytics.js");
  return getIssuanceAnalytics(organizationId);
}

export async function getCertificateDownloadAnalytics(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  await assertOrgFeature(userId, organizationId, BillingFeatureKeys.analytics);
  const { getDownloadAnalytics } = await import("./certificates.analytics.js");
  return getDownloadAnalytics(organizationId);
}

export async function getCertificateVerificationAnalytics(userId: string, organizationId: string) {
  await assertOrgAdmin(userId, organizationId);
  await assertOrgFeature(userId, organizationId, BillingFeatureKeys.analytics);
  const { getVerificationAnalytics } = await import("./certificates.analytics.js");
  return getVerificationAnalytics(organizationId);
}

export async function adminReprocessCertificates(
  userId: string,
  organizationId: string,
  input: {
    certificateIds?: string[];
    limit?: number;
    renderFormat?: "pdf" | "png" | "svg";
    skipRender?: boolean;
  },
) {
  await assertOrgAdmin(userId, organizationId);
  const { reprocessCertificates } = await import("./certificates.admin.js");
  return reprocessCertificates(userId, organizationId, input);
}

export async function adminCleanupCertificates(
  userId: string,
  organizationId: string,
  policy?: {
    eventDays?: number;
    bulkJobDays?: number;
    temporaryAssetEventDays?: number;
  },
) {
  await assertOrgAdmin(userId, organizationId);
  const { runCertificateAdminCleanup } = await import("./certificates.admin.js");
  return runCertificateAdminCleanup(organizationId, policy);
}
