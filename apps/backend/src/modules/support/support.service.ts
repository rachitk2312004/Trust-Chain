import { randomUUID } from "node:crypto";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { getObjectBuffer, putObjectBuffer } from "../../integrations/objectStorage.js";
import { writeAdminAudit } from "../admin/admin.audit.js";
import { listRoleBindingsForUser } from "../auth/rbac.repository.js";
import {
  canAccessBug,
  canAccessInquiry,
  canCreateBug,
  canCreateInquiry,
  canRespondToBug,
  canUseInquiries,
  decodeImagePayload,
  imageExtension,
  isSuperAdminBindings,
  nextInquiryStatusAfterMessage,
  orgAdminOrganizationIds,
} from "./support.access.js";
import { BugStatuses, InquiryStatuses } from "./support.schemas.js";

function publicUser(user: {
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
  };
}

async function actorContext(userId: string) {
  const bindings = await listRoleBindingsForUser(userId);
  return {
    userId,
    bindings,
    isSuperAdmin: isSuperAdminBindings(bindings),
    orgAdminOrgIds: orgAdminOrganizationIds(bindings),
  };
}

async function resolveOrganizationId(
  actor: Awaited<ReturnType<typeof actorContext>>,
  requested?: string,
  requireOrgAdmin = false,
): Promise<string | null> {
  if (requested) {
    if (requireOrgAdmin && !actor.orgAdminOrgIds.includes(requested)) {
      throw new AppError(403, "FORBIDDEN", "You can only attach your own organization.");
    }
    if (!requireOrgAdmin) {
      const allowed =
        actor.orgAdminOrgIds.includes(requested) ||
        Boolean(
          await prisma.membership.findFirst({
            where: { userId: actor.userId, organizationId: requested, status: "active" },
            select: { id: true },
          }),
        );
      if (!allowed) {
        return actor.orgAdminOrgIds[0] ?? null;
      }
    }
    return requested;
  }
  return actor.orgAdminOrgIds[0] ?? null;
}

export async function getSupportSummary(userId: string) {
  const actor = await actorContext(userId);
  if (actor.isSuperAdmin) {
    const [openInquiries, openBugs] = await Promise.all([
      prisma.platformInquiry.count({ where: { status: InquiryStatuses.open } }),
      prisma.bugReport.count({
        where: { status: { in: [BugStatuses.open, BugStatuses.acknowledged, BugStatuses.inProgress] } },
      }),
    ]);
    return {
      inquiries: openInquiries,
      bugs: openBugs,
      canUseInquiries: true,
      canCreateInquiry: false,
      canReportBugs: false,
    };
  }

  const inquiryWhere = {
    OR: [
      { createdById: userId },
      ...(actor.orgAdminOrgIds.length ? [{ organizationId: { in: actor.orgAdminOrgIds } }] : []),
    ],
  };

  const [waitingInquiries, ownOpenBugs] = await Promise.all([
    canUseInquiries(actor.bindings)
      ? prisma.platformInquiry.count({
          where: { ...inquiryWhere, status: { in: [InquiryStatuses.open, InquiryStatuses.answered] } },
        })
      : 0,
    canCreateBug(actor.bindings)
      ? prisma.bugReport.count({
          where: { reporterId: userId, status: { in: [BugStatuses.open, BugStatuses.acknowledged, BugStatuses.inProgress] } },
        })
      : 0,
  ]);

  return {
    inquiries: waitingInquiries,
    bugs: ownOpenBugs,
    canUseInquiries: canUseInquiries(actor.bindings),
    canCreateInquiry: canCreateInquiry(actor.bindings),
    canReportBugs: canCreateBug(actor.bindings),
  };
}

export async function listInquiries(userId: string) {
  const actor = await actorContext(userId);
  if (!canUseInquiries(actor.bindings)) {
    throw new AppError(403, "FORBIDDEN", "Platform queries are limited to organization admins and super admins.");
  }

  const rows = await prisma.platformInquiry.findMany({
    where: actor.isSuperAdmin
      ? undefined
      : {
          OR: [
            { createdById: userId },
            { organizationId: { in: actor.orgAdminOrgIds } },
          ],
        },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true },
      },
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return {
    inquiries: rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      organizationName: row.organization?.name ?? null,
      organizationSlug: row.organization?.slug ?? null,
      subject: row.subject,
      status: row.status,
      createdBy: publicUser(row.createdBy),
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      preview: row.messages[0]?.body ?? "",
    })),
  };
}

export async function createInquiry(
  userId: string,
  input: { subject: string; body: string; organizationId?: string },
) {
  const actor = await actorContext(userId);
  if (!canCreateInquiry(actor.bindings)) {
    throw new AppError(403, "FORBIDDEN", "Only organization admins can start a platform query.");
  }
  const organizationId = await resolveOrganizationId(actor, input.organizationId, true);
  if (!organizationId) {
    throw new AppError(400, "ORGANIZATION_REQUIRED", "An organization is required for platform queries.");
  }

  const now = new Date();
  const created = await prisma.platformInquiry.create({
    data: {
      organizationId,
      createdById: userId,
      subject: input.subject,
      status: InquiryStatuses.open,
      lastMessageAt: now,
      messages: {
        create: {
          senderId: userId,
          body: input.body,
        },
      },
    },
    select: { id: true },
  });

  await writeAdminAudit({
    actorUserId: userId,
    action: "support.inquiry.create",
    targetType: "platform_inquiry",
    targetId: created.id,
    organizationId,
    meta: { subject: input.subject },
  });

  return getInquiry(userId, created.id);
}

export async function getInquiry(userId: string, inquiryId: string) {
  const actor = await actorContext(userId);
  if (!canUseInquiries(actor.bindings)) {
    throw new AppError(403, "FORBIDDEN", "Platform queries are limited to organization admins and super admins.");
  }

  const row = await prisma.platformInquiry.findUnique({
    where: { id: inquiryId },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Query not found.");
  if (!canAccessInquiry(actor.bindings, row, userId)) {
    throw new AppError(403, "FORBIDDEN", "You cannot view this query.");
  }

  return {
    inquiry: {
      id: row.id,
      organizationId: row.organizationId,
      organizationName: row.organization?.name ?? null,
      organizationSlug: row.organization?.slug ?? null,
      subject: row.subject,
      status: row.status,
      createdBy: publicUser(row.createdBy),
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messages: row.messages.map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        sender: publicUser(message.sender),
      })),
    },
  };
}

export async function postInquiryMessage(userId: string, inquiryId: string, body: string) {
  const actor = await actorContext(userId);
  const existing = await prisma.platformInquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, createdById: true, organizationId: true, status: true },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Query not found.");
  if (!canAccessInquiry(actor.bindings, existing, userId)) {
    throw new AppError(403, "FORBIDDEN", "You cannot reply to this query.");
  }

  const status = nextInquiryStatusAfterMessage(actor.isSuperAdmin, existing.status);
  await prisma.$transaction([
    prisma.platformInquiryMessage.create({
      data: { inquiryId, senderId: userId, body },
    }),
    prisma.platformInquiry.update({
      where: { id: inquiryId },
      data: { status, lastMessageAt: new Date() },
    }),
  ]);

  await writeAdminAudit({
    actorUserId: userId,
    action: "support.inquiry.reply",
    targetType: "platform_inquiry",
    targetId: inquiryId,
    organizationId: existing.organizationId,
    meta: { status },
  });

  return getInquiry(userId, inquiryId);
}

export async function closeInquiry(userId: string, inquiryId: string) {
  const actor = await actorContext(userId);
  const existing = await prisma.platformInquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, createdById: true, organizationId: true },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Query not found.");
  if (!canAccessInquiry(actor.bindings, existing, userId)) {
    throw new AppError(403, "FORBIDDEN", "You cannot close this query.");
  }

  await prisma.platformInquiry.update({
    where: { id: inquiryId },
    data: { status: InquiryStatuses.closed },
  });

  await writeAdminAudit({
    actorUserId: userId,
    action: "support.inquiry.close",
    targetType: "platform_inquiry",
    targetId: inquiryId,
    organizationId: existing.organizationId,
  });

  return getInquiry(userId, inquiryId);
}

export async function listBugs(userId: string) {
  const actor = await actorContext(userId);
  if (!actor.isSuperAdmin && !canCreateBug(actor.bindings)) {
    throw new AppError(403, "FORBIDDEN", "You cannot view bug reports.");
  }

  const rows = await prisma.bugReport.findMany({
    where: actor.isSuperAdmin ? undefined : { reporterId: userId },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      reporter: { select: { id: true, email: true, firstName: true, lastName: true } },
      responses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, statusAfter: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return {
    bugs: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      hasImage: Boolean(row.imageObjectKey),
      organizationId: row.organizationId,
      organizationName: row.organization?.name ?? null,
      reporter: publicUser(row.reporter),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastResponse: row.responses[0]
        ? {
            body: row.responses[0].body,
            statusAfter: row.responses[0].statusAfter,
            createdAt: row.responses[0].createdAt.toISOString(),
          }
        : null,
    })),
  };
}

export async function createBug(
  userId: string,
  input: {
    title: string;
    description: string;
    organizationId?: string;
    imageBase64?: string;
    imageContentType?: string;
  },
) {
  const actor = await actorContext(userId);
  if (!canCreateBug(actor.bindings)) {
    throw new AppError(403, "FORBIDDEN", "Super admins review bug reports instead of filing them.");
  }

  const organizationId = await resolveOrganizationId(actor, input.organizationId, false);
  const id = randomUUID();
  let imageObjectKey: string | null = null;
  let imageContentType: string | null = null;

  if (input.imageBase64) {
    if (!input.imageContentType) {
      throw new AppError(400, "IMAGE_TYPE_REQUIRED", "Screenshot type is required when an image is attached.");
    }
    const body = decodeImagePayload(input.imageBase64, input.imageContentType);
    imageContentType = input.imageContentType;
    imageObjectKey = `support/bugs/${id}/${randomUUID()}.${imageExtension(input.imageContentType)}`;
    await putObjectBuffer({
      objectKey: imageObjectKey,
      body,
      contentType: input.imageContentType,
    });
  }

  await prisma.bugReport.create({
    data: {
      id,
      reporterId: userId,
      organizationId,
      title: input.title,
      description: input.description,
      imageObjectKey,
      imageContentType,
      status: BugStatuses.open,
    },
  });

  await writeAdminAudit({
    actorUserId: userId,
    action: "support.bug.create",
    targetType: "bug_report",
    targetId: id,
    organizationId,
    meta: { title: input.title, hasImage: Boolean(imageObjectKey) },
  });

  return getBug(userId, id);
}

export async function getBug(userId: string, bugId: string) {
  const actor = await actorContext(userId);
  const row = await prisma.bugReport.findUnique({
    where: { id: bugId },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      reporter: { select: { id: true, email: true, firstName: true, lastName: true } },
      responses: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Bug report not found.");
  if (!canAccessBug(actor.bindings, row.reporterId, userId)) {
    throw new AppError(403, "FORBIDDEN", "You cannot view this bug report.");
  }

  return {
    bug: {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      hasImage: Boolean(row.imageObjectKey),
      organizationId: row.organizationId,
      organizationName: row.organization?.name ?? null,
      reporter: publicUser(row.reporter),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      responses: row.responses.map((response) => ({
        id: response.id,
        body: response.body,
        statusAfter: response.statusAfter,
        createdAt: response.createdAt.toISOString(),
        actor: publicUser(response.actor),
      })),
    },
  };
}

export async function getBugImage(userId: string, bugId: string) {
  const actor = await actorContext(userId);
  const row = await prisma.bugReport.findUnique({
    where: { id: bugId },
    select: {
      reporterId: true,
      imageObjectKey: true,
      imageContentType: true,
    },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Bug report not found.");
  if (!canAccessBug(actor.bindings, row.reporterId, userId)) {
    throw new AppError(403, "FORBIDDEN", "You cannot view this screenshot.");
  }
  if (!row.imageObjectKey) {
    throw new AppError(404, "NOT_FOUND", "This report has no screenshot.");
  }
  const stored = await getObjectBuffer(row.imageObjectKey);
  if (!stored.exists || !stored.body) {
    throw new AppError(404, "NOT_FOUND", "Screenshot is no longer available.");
  }
  return {
    body: stored.body,
    contentType: row.imageContentType ?? stored.contentType ?? "application/octet-stream",
  };
}

export async function respondToBug(
  userId: string,
  bugId: string,
  input: { body: string; status?: string },
) {
  const actor = await actorContext(userId);
  if (!canRespondToBug(actor.bindings)) {
    throw new AppError(403, "FORBIDDEN", "Only super admins can respond to bug reports.");
  }
  const existing = await prisma.bugReport.findUnique({
    where: { id: bugId },
    select: { id: true, status: true, organizationId: true },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Bug report not found.");

  const status = input.status ?? existing.status;
  await prisma.$transaction([
    prisma.bugReportResponse.create({
      data: {
        reportId: bugId,
        actorId: userId,
        body: input.body,
        statusAfter: status,
      },
    }),
    prisma.bugReport.update({
      where: { id: bugId },
      data: { status },
    }),
  ]);

  await writeAdminAudit({
    actorUserId: userId,
    action: "support.bug.respond",
    targetType: "bug_report",
    targetId: bugId,
    organizationId: existing.organizationId,
    meta: { status },
  });

  return getBug(userId, bugId);
}

export async function commentOnBug(userId: string, bugId: string, body: string) {
  const actor = await actorContext(userId);
  const existing = await prisma.bugReport.findUnique({
    where: { id: bugId },
    select: { id: true, reporterId: true, organizationId: true, status: true },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Bug report not found.");
  if (existing.reporterId !== userId || actor.isSuperAdmin) {
    throw new AppError(403, "FORBIDDEN", "Only the reporter can add a follow-up on their report.");
  }

  await prisma.$transaction([
    prisma.bugReportResponse.create({
      data: {
        reportId: bugId,
        actorId: userId,
        body,
        statusAfter: existing.status,
      },
    }),
    prisma.bugReport.update({
      where: { id: bugId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return getBug(userId, bugId);
}
