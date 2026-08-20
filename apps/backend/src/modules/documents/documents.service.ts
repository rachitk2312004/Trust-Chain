import {
  DeveloperEventTypes,
  DocumentPermissions,
  DocumentStatuses,
  DocumentUploadSessionStatuses,
  NotificationEventTypes,
  RoleKeys,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  createDownloadUrl,
  createUploadUrl,
  headObject,
  streamSha256Object,
} from "../../integrations/objectStorage.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { publishDeveloperEventSafe } from "../developer/developer.delivery.js";
import {
  assertDocumentPermission,
  isDocumentExpired,
  type DocumentAccessContext,
  type DocumentPermission,
} from "./documents.access.js";
import { assertAllowedMimeType, assertAllowedSize, assertObjectKeyPrefix } from "./documentFile.js";
import { encryptDocumentObject } from "./encryption.js";
import { scanDocumentObject } from "./malwareScan.js";
import { invalidateVerificationCacheForDocument } from "../verification/services/cacheInvalidation.js";
import { invalidatePublicSnapshots } from "../public-verification/services/publicVerification.service.js";
import { invalidateQrAssets } from "../qr/services/qr.service.js";
import { emitDomainNotification } from "../notifications/notification.emit.js";

const UPLOAD_SESSION_TTL_MS = 15 * 60 * 1000;

function toAccessContext(doc: {
  id: string;
  organizationId: string;
  createdById: string;
  status: string;
  deletedAt: Date | null;
  expiresAt: Date | null;
  archivedAt: Date | null;
}): DocumentAccessContext {
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    createdById: doc.createdById,
    status: doc.status,
    deletedAt: doc.deletedAt,
    expiresAt: doc.expiresAt,
    archivedAt: doc.archivedAt,
  };
}

async function assertOrgMember(userId: string, organizationId: string): Promise<void> {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Organization membership required");
  }
}

async function writeAudit(input: {
  documentId: string;
  organizationId: string;
  actorUserId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.documentAuditEntry.create({
    data: {
      documentId: input.documentId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      metadata: input.metadata ?? undefined,
    },
  });
}

function publicDocument(
  doc: {
    id: string;
    organizationId: string;
    createdById: string;
    title: string;
    description: string | null;
    categoryId: string | null;
    currentVersionId: string | null;
    status: string;
    expiresAt: Date | null;
    archivedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    category?: { id: string; name: string } | null;
    tags?: { tag: { id: string; name: string } }[];
    currentVersion?: {
      id: string;
      versionNumber: number;
      contentHash: string;
      mimeType: string;
      sizeBytes: bigint;
      originalFileName: string;
      createdAt: Date;
    } | null;
  },
  permission?: DocumentPermission | null,
) {
  const expired = isDocumentExpired(toAccessContext(doc));
  const status =
    !doc.deletedAt && expired && doc.status !== DocumentStatuses.archived
      ? DocumentStatuses.expired
      : doc.status;

  return {
    id: doc.id,
    organizationId: doc.organizationId,
    createdById: doc.createdById,
    title: doc.title,
    description: doc.description,
    categoryId: doc.categoryId,
    category: doc.category ?? null,
    tags: (doc.tags ?? []).map((t) => t.tag),
    currentVersionId: doc.currentVersionId,
    currentVersion: doc.currentVersion
      ? {
          id: doc.currentVersion.id,
          versionNumber: doc.currentVersion.versionNumber,
          contentHash: doc.currentVersion.contentHash,
          mimeType: doc.currentVersion.mimeType,
          sizeBytes: Number(doc.currentVersion.sizeBytes),
          originalFileName: doc.currentVersion.originalFileName,
          createdAt: doc.currentVersion.createdAt,
        }
      : null,
    status,
    expiresAt: doc.expiresAt,
    archivedAt: doc.archivedAt,
    deletedAt: doc.deletedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    permission: permission ?? undefined,
  };
}

const documentInclude = {
  category: { select: { id: true, name: true } },
  tags: { include: { tag: { select: { id: true, name: true } } } },
  currentVersion: true,
} satisfies Prisma.DocumentInclude;

async function loadDocument(organizationId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
    include: documentInclude,
  });
  if (!doc) {
    throw new AppError(404, "DOC_NOT_FOUND", "Document not found");
  }
  return doc;
}

async function syncTags(documentId: string, organizationId: string, tagIds: string[]) {
  if (tagIds.length) {
    const tags = await prisma.documentTag.findMany({
      where: { organizationId, id: { in: tagIds } },
    });
    if (tags.length !== tagIds.length) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "One or more tags were not found in this organization",
      );
    }
  }
  await prisma.documentTagOnDocument.deleteMany({ where: { documentId } });
  if (tagIds.length) {
    await prisma.documentTagOnDocument.createMany({
      data: tagIds.map((tagId) => ({ documentId, tagId })),
    });
  }
}

// --- Categories & tags ---

export async function createCategory(
  userId: string,
  organizationId: string,
  input: { name: string; description?: string | null },
) {
  await assertOrgMember(userId, organizationId);
  const isAdmin = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!isAdmin) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
  try {
    return await prisma.documentCategory.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description ?? null,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(409, "CONFLICT", "Category name already exists");
    }
    throw error;
  }
}

export async function listCategories(userId: string, organizationId: string) {
  await assertOrgMember(userId, organizationId);
  return prisma.documentCategory.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
}

export async function patchCategory(
  userId: string,
  organizationId: string,
  categoryId: string,
  input: { name?: string; description?: string | null },
) {
  await assertOrgMember(userId, organizationId);
  const isAdmin = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!isAdmin) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
  const existing = await prisma.documentCategory.findFirst({
    where: { id: categoryId, organizationId },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Category not found");
  try {
    return await prisma.documentCategory.update({
      where: { id: categoryId },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(409, "CONFLICT", "Category name already exists");
    }
    throw error;
  }
}

export async function deleteCategory(userId: string, organizationId: string, categoryId: string) {
  await assertOrgMember(userId, organizationId);
  const isAdmin = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!isAdmin) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
  const existing = await prisma.documentCategory.findFirst({
    where: { id: categoryId, organizationId },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Category not found");
  await prisma.documentCategory.delete({ where: { id: categoryId } });
}

export async function createTag(userId: string, organizationId: string, input: { name: string }) {
  await assertOrgMember(userId, organizationId);
  try {
    return await prisma.documentTag.create({
      data: { organizationId, name: input.name },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(409, "CONFLICT", "Tag name already exists");
    }
    throw error;
  }
}

export async function listTags(userId: string, organizationId: string) {
  await assertOrgMember(userId, organizationId);
  return prisma.documentTag.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
}

export async function patchTag(
  userId: string,
  organizationId: string,
  tagId: string,
  input: { name: string },
) {
  await assertOrgMember(userId, organizationId);
  const existing = await prisma.documentTag.findFirst({
    where: { id: tagId, organizationId },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Tag not found");
  try {
    return await prisma.documentTag.update({
      where: { id: tagId },
      data: { name: input.name },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(409, "CONFLICT", "Tag name already exists");
    }
    throw error;
  }
}

export async function deleteTag(userId: string, organizationId: string, tagId: string) {
  await assertOrgMember(userId, organizationId);
  const existing = await prisma.documentTag.findFirst({
    where: { id: tagId, organizationId },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Tag not found");
  await prisma.documentTag.delete({ where: { id: tagId } });
}

// --- Documents ---

export async function createDocument(
  userId: string,
  organizationId: string,
  input: {
    title: string;
    description?: string;
    categoryId?: string | null;
    tagIds?: string[];
    expiresAt?: string | null;
  },
) {
  await assertOrgMember(userId, organizationId);

  if (input.categoryId) {
    const category = await prisma.documentCategory.findFirst({
      where: { id: input.categoryId, organizationId },
    });
    if (!category) throw new AppError(400, "VALIDATION_ERROR", "Category not found");
  }

  const doc = await prisma.document.create({
    data: {
      organizationId,
      createdById: userId,
      title: input.title,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      status: DocumentStatuses.pendingUpload,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });

  if (input.tagIds?.length) {
    await syncTags(doc.id, organizationId, input.tagIds);
  }

  await writeAudit({
    documentId: doc.id,
    organizationId,
    actorUserId: userId,
    action: "document.created",
  });

  publishDeveloperEventSafe({
    organizationId,
    eventType: DeveloperEventTypes.documentCreated,
    data: { documentId: doc.id, title: doc.title, status: doc.status },
  });

  const full = await loadDocument(organizationId, doc.id);
  return publicDocument(full, DocumentPermissions.manage);
}

export async function createDocumentUploadUrl(
  userId: string,
  organizationId: string,
  documentId: string,
  input: { mimeType: string; originalFileName: string; expectedSizeBytes?: number },
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.edit);

  if (doc.deletedAt) {
    throw new AppError(410, "DOC_DELETED", "Document has been deleted");
  }
  if (doc.status === DocumentStatuses.archived) {
    throw new AppError(409, "DOC_ARCHIVED", "Archived documents cannot receive new uploads");
  }

  assertAllowedMimeType(input.mimeType);
  if (input.expectedSizeBytes != null) {
    assertAllowedSize(input.expectedSizeBytes);
  }

  const safeName = input.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const objectKey = `orgs/${organizationId}/documents/${documentId}/${Date.now()}-${safeName}`;
  const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_MS);

  const session = await prisma.documentUploadSession.create({
    data: {
      documentId,
      organizationId,
      createdById: userId,
      objectKey,
      expectedMimeType: input.mimeType,
      expectedSizeBytes: input.expectedSizeBytes != null ? BigInt(input.expectedSizeBytes) : null,
      status: DocumentUploadSessionStatuses.pending,
      expiresAt,
    },
  });

  const upload = await createUploadUrl({
    objectKey,
    contentType: input.mimeType,
    expiresInSeconds: Math.floor(UPLOAD_SESSION_TTL_MS / 1000),
  });

  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.upload_session.created",
    metadata: { uploadSessionId: session.id, objectKey },
  });

  return {
    uploadSession: {
      id: session.id,
      documentId,
      objectKey: session.objectKey,
      status: session.status,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    },
    ...upload,
  };
}

export async function confirmDocumentVersion(
  userId: string,
  organizationId: string,
  documentId: string,
  input: {
    uploadSessionId: string;
    contentHash: string;
    mimeType: string;
    sizeBytes: number;
    originalFileName: string;
    activate?: boolean;
  },
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.edit);

  if (doc.deletedAt) {
    throw new AppError(410, "DOC_DELETED", "Document has been deleted");
  }

  assertAllowedMimeType(input.mimeType);
  assertAllowedSize(input.sizeBytes);

  const contentHash = input.contentHash.toLowerCase();

  const session = await prisma.documentUploadSession.findFirst({
    where: {
      id: input.uploadSessionId,
      documentId,
      organizationId,
    },
  });
  if (!session) {
    throw new AppError(404, "DOC_UPLOAD_INCOMPLETE", "Upload session not found");
  }
  if (session.status !== DocumentUploadSessionStatuses.pending) {
    throw new AppError(409, "DOC_UPLOAD_INCOMPLETE", "Upload session is not pending");
  }
  if (session.expiresAt <= new Date()) {
    await prisma.documentUploadSession.update({
      where: { id: session.id },
      data: { status: DocumentUploadSessionStatuses.expired },
    });
    throw new AppError(410, "DOC_UPLOAD_INCOMPLETE", "Upload session has expired");
  }

  assertObjectKeyPrefix(session.objectKey, organizationId);

  if (session.expectedMimeType !== input.mimeType) {
    throw new AppError(400, "DOC_INVALID_MIME", "MIME type does not match upload session");
  }
  if (session.expectedSizeBytes != null && Number(session.expectedSizeBytes) !== input.sizeBytes) {
    throw new AppError(400, "DOC_TOO_LARGE", "Size does not match upload session expectation");
  }

  const head = await headObject(session.objectKey);
  if (!head.exists) {
    throw new AppError(400, "DOC_UPLOAD_INCOMPLETE", "Object not found in storage");
  }
  if (head.contentLength != null && head.contentLength !== input.sizeBytes) {
    throw new AppError(400, "DOC_HASH_MISMATCH", "Reported size does not match stored object", {
      stored: head.contentLength,
      reported: input.sizeBytes,
    });
  }

  // Server-side streaming SHA-256 — constant memory; never trust client hash alone.
  const digest = await streamSha256Object(session.objectKey);
  if (digest.hash !== contentHash) {
    throw new AppError(400, "DOC_HASH_MISMATCH", "Server content hash does not match client hash", {
      serverHash: digest.hash,
      clientHash: contentHash,
      bytesRead: digest.bytesRead,
    });
  }
  if (digest.bytesRead !== input.sizeBytes) {
    throw new AppError(400, "DOC_HASH_MISMATCH", "Hashed byte count does not match reported size", {
      bytesRead: digest.bytesRead,
      reported: input.sizeBytes,
    });
  }

  const scan = await scanDocumentObject({
    objectKey: session.objectKey,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    contentHash,
  });
  if (!scan.clean) {
    throw new AppError(400, "DOC_MALWARE", "Malware scan failed", { reason: scan.reason });
  }

  const encrypted = await encryptDocumentObject({
    objectKey: session.objectKey,
    mimeType: input.mimeType,
    contentHash,
  });

  // Same-document content dedupe: do not create another version with identical hash.
  const sameDocHash = await prisma.documentVersion.findFirst({
    where: { documentId, contentHash },
  });
  if (sameDocHash) {
    throw new AppError(
      409,
      "DOC_DUPLICATE_CONTENT",
      "A version with this content hash already exists for this document",
      { existingVersionId: sameDocHash.id },
    );
  }

  // Org-wide dedupe: reuse an existing object key when the same hash already exists.
  const existingOrgVersion = await prisma.documentVersion.findFirst({
    where: {
      contentHash,
      document: { organizationId },
    },
    orderBy: { createdAt: "asc" },
  });
  const objectKey = existingOrgVersion?.objectKey ?? encrypted.objectKey;

  const latest = await prisma.documentVersion.findFirst({
    where: { documentId },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;

  const nextStatus =
    input.activate === true
      ? DocumentStatuses.active
      : doc.status === DocumentStatuses.pendingUpload
        ? DocumentStatuses.draft
        : doc.status === DocumentStatuses.active
          ? DocumentStatuses.active
          : DocumentStatuses.draft;

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.documentVersion.create({
      data: {
        documentId,
        versionNumber,
        objectKey,
        contentHash,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        originalFileName: input.originalFileName,
        uploadedById: userId,
        encrypted: encrypted.encrypted,
        encryptionAlgorithm: encrypted.encrypted ? encrypted.encryptionAlgorithm : null,
        keyVersion: encrypted.encrypted ? encrypted.keyVersion : null,
        wrappedDek: encrypted.encrypted ? encrypted.wrappedDek : null,
        iv: encrypted.encrypted ? encrypted.iv : null,
        authTag: encrypted.encrypted ? encrypted.authTag : null,
        encryptionMetadata: encrypted.encrypted
          ? (encrypted.encryptionMetadata as Prisma.InputJsonValue)
          : undefined,
      },
    });

    await tx.document.update({
      where: { id: documentId },
      data: {
        currentVersionId: created.id,
        status: nextStatus,
      },
    });

    await tx.documentUploadSession.update({
      where: { id: session.id },
      data: {
        status: DocumentUploadSessionStatuses.completed,
        completedAt: new Date(),
      },
    });

    return created;
  });

  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.version.confirmed",
    metadata: {
      versionId: version.id,
      versionNumber,
      contentHash,
      deduplicated: Boolean(existingOrgVersion),
      reusedObjectKeyFromVersionId: existingOrgVersion?.id ?? null,
      uploadSessionId: session.id,
    },
  });
  await invalidateVerificationCacheForDocument(organizationId, documentId, "version_created");
  await invalidatePublicSnapshots(organizationId, documentId);
  await invalidateQrAssets(organizationId, documentId);

  const full = await loadDocument(organizationId, documentId);
  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.documentUploaded,
    entityId: version.id,
    entityType: "document_version",
    title: "Document uploaded",
    message: `"${full.title}" version ${version.versionNumber} was uploaded.`,
    metadata: {
      documentId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      contentHash,
    },
    recipientUserIds: [full.createdById, userId],
  });

  return {
    document: publicDocument(full, DocumentPermissions.edit),
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      contentHash: version.contentHash,
      mimeType: version.mimeType,
      sizeBytes: Number(version.sizeBytes),
      originalFileName: version.originalFileName,
      objectKey: version.objectKey,
      createdAt: version.createdAt,
      deduplicated: Boolean(existingOrgVersion),
    },
  };
}

export async function getDocument(userId: string, organizationId: string, documentId: string) {
  const doc = await loadDocument(organizationId, documentId);
  const permission = await assertDocumentPermission(
    userId,
    toAccessContext(doc),
    DocumentPermissions.view,
  );
  return publicDocument(doc, permission);
}

export async function listDocuments(
  userId: string,
  organizationId: string,
  query: {
    q?: string;
    status?: string;
    categoryId?: string;
    tag?: string;
    expiresBefore?: string;
    includeDeleted?: boolean;
    limit: number;
    offset: number;
  },
) {
  await assertOrgMember(userId, organizationId);

  const where: Prisma.DocumentWhereInput = {
    organizationId,
    deletedAt: query.includeDeleted ? undefined : null,
  };

  if (query.status) where.status = query.status;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.expiresBefore) where.expiresAt = { lte: new Date(query.expiresBefore) };
  if (query.tag) {
    where.tags = { some: { tag: { name: { equals: query.tag, mode: "insensitive" } } } };
  }
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
      { tags: { some: { tag: { name: { contains: query.q, mode: "insensitive" } } } } },
    ];
  }

  const rows = await prisma.document.findMany({
    where,
    include: documentInclude,
    orderBy: { updatedAt: "desc" },
    take: query.limit,
    skip: query.offset,
  });

  const visible = [];
  for (const row of rows) {
    try {
      const permission = await assertDocumentPermission(
        userId,
        toAccessContext(row),
        DocumentPermissions.view,
      );
      visible.push(publicDocument(row, permission));
    } catch {
      // skip inaccessible
    }
  }

  return { documents: visible, limit: query.limit, offset: query.offset };
}

export async function patchDocument(
  userId: string,
  organizationId: string,
  documentId: string,
  input: {
    title?: string;
    description?: string | null;
    categoryId?: string | null;
    tagIds?: string[];
    status?: string;
  },
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.edit);

  if (doc.deletedAt) throw new AppError(410, "DOC_DELETED", "Document has been deleted");
  if (doc.status === DocumentStatuses.pendingUpload && input.status) {
    throw new AppError(
      409,
      "DOC_UPLOAD_INCOMPLETE",
      "Complete an upload before changing lifecycle status",
    );
  }

  if (input.categoryId) {
    const category = await prisma.documentCategory.findFirst({
      where: { id: input.categoryId, organizationId },
    });
    if (!category) throw new AppError(400, "VALIDATION_ERROR", "Category not found");
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      title: input.title,
      description: input.description === undefined ? undefined : input.description,
      categoryId: input.categoryId === undefined ? undefined : input.categoryId,
      status: input.status,
    },
  });

  if (input.tagIds) {
    await syncTags(documentId, organizationId, input.tagIds);
  }

  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.updated",
    metadata: input as Prisma.InputJsonValue,
  });
  await invalidateVerificationCacheForDocument(organizationId, documentId, "document_updated");
  await invalidatePublicSnapshots(organizationId, documentId);
  await invalidateQrAssets(organizationId, documentId);

  publishDeveloperEventSafe({
    organizationId,
    eventType: DeveloperEventTypes.documentUpdated,
    data: { documentId, ...input },
  });

  const full = await loadDocument(organizationId, documentId);
  return publicDocument(full, DocumentPermissions.edit);
}

export async function softDeleteDocument(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.manage);
  if (doc.deletedAt) return publicDocument(doc, DocumentPermissions.manage);

  await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.deleted",
  });
  const full = await loadDocument(organizationId, documentId);
  return publicDocument(full, DocumentPermissions.manage);
}

export async function archiveDocument(userId: string, organizationId: string, documentId: string) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.edit);
  if (doc.deletedAt) throw new AppError(410, "DOC_DELETED", "Document has been deleted");
  if (doc.status === DocumentStatuses.pendingUpload) {
    throw new AppError(409, "DOC_UPLOAD_INCOMPLETE", "Cannot archive before first upload");
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: DocumentStatuses.archived,
      archivedAt: new Date(),
    },
  });
  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.archived",
  });
  await invalidateVerificationCacheForDocument(organizationId, documentId, "document_archived");
  await invalidatePublicSnapshots(organizationId, documentId);
  await invalidateQrAssets(organizationId, documentId);
  const full = await loadDocument(organizationId, documentId);
  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.documentArchived,
    entityId: documentId,
    entityType: "document",
    title: "Document archived",
    message: `"${full.title}" was archived.`,
    metadata: { documentId },
    recipientUserIds: [full.createdById, userId],
  });
  return publicDocument(full, DocumentPermissions.edit);
}

export async function restoreDocument(userId: string, organizationId: string, documentId: string) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.edit);
  if (doc.deletedAt) throw new AppError(410, "DOC_DELETED", "Document has been deleted");
  if (doc.status !== DocumentStatuses.archived) {
    throw new AppError(409, "DOC_ARCHIVED", "Document is not archived");
  }

  const nextStatus = isDocumentExpired(toAccessContext(doc))
    ? DocumentStatuses.expired
    : doc.currentVersionId
      ? DocumentStatuses.active
      : DocumentStatuses.draft;

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: nextStatus,
      archivedAt: null,
    },
  });
  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.restored",
    metadata: { status: nextStatus },
  });
  await invalidateVerificationCacheForDocument(organizationId, documentId, "document_restored");
  await invalidatePublicSnapshots(organizationId, documentId);
  await invalidateQrAssets(organizationId, documentId);
  const full = await loadDocument(organizationId, documentId);
  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.documentRestored,
    entityId: documentId,
    entityType: "document",
    title: "Document restored",
    message: `"${full.title}" was restored (${nextStatus}).`,
    metadata: { documentId, status: nextStatus },
    recipientUserIds: [full.createdById, userId],
  });
  return publicDocument(full, DocumentPermissions.edit);
}

export async function setDocumentExpiration(
  userId: string,
  organizationId: string,
  documentId: string,
  expiresAt: string | null,
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.edit);
  if (doc.deletedAt) throw new AppError(410, "DOC_DELETED", "Document has been deleted");

  const nextExpires = expiresAt ? new Date(expiresAt) : null;
  let nextStatus = doc.status;
  if (doc.status !== DocumentStatuses.archived && doc.status !== DocumentStatuses.pendingUpload) {
    if (nextExpires && nextExpires <= new Date()) {
      nextStatus = DocumentStatuses.expired;
    } else if (doc.status === DocumentStatuses.expired) {
      nextStatus = doc.currentVersionId ? DocumentStatuses.active : DocumentStatuses.draft;
    }
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { expiresAt: nextExpires, status: nextStatus },
  });
  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.expiration.set",
    metadata: { expiresAt: nextExpires?.toISOString() ?? null, status: nextStatus },
  });
  const full = await loadDocument(organizationId, documentId);
  return publicDocument(full, DocumentPermissions.edit);
}

export async function listDocumentVersions(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.view);

  const versions = await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { versionNumber: "desc" },
  });

  return versions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    contentHash: v.contentHash,
    mimeType: v.mimeType,
    sizeBytes: Number(v.sizeBytes),
    originalFileName: v.originalFileName,
    uploadedById: v.uploadedById,
    createdAt: v.createdAt,
    isCurrent: v.id === doc.currentVersionId,
  }));
}

async function assertDownloadAllowed(
  userId: string,
  doc: Awaited<ReturnType<typeof loadDocument>>,
) {
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.download);
  if (doc.deletedAt) throw new AppError(410, "DOC_DELETED", "Document has been deleted");
  if (doc.status === DocumentStatuses.pendingUpload || !doc.currentVersionId) {
    throw new AppError(409, "DOC_UPLOAD_INCOMPLETE", "Document has no downloadable version yet");
  }
  if (isDocumentExpired(toAccessContext(doc)) && doc.status !== DocumentStatuses.archived) {
    // still allow download of expired for manage? Plan says honor expiration — block download.
    const isAdmin = await userHasRole(
      userId,
      [RoleKeys.superAdmin, RoleKeys.orgAdmin],
      doc.organizationId,
    );
    if (!isAdmin && doc.createdById !== userId) {
      throw new AppError(410, "DOC_EXPIRED", "Document has expired");
    }
  }
}

export async function createDocumentDownloadUrl(
  userId: string,
  organizationId: string,
  documentId: string,
  versionId?: string,
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDownloadAllowed(userId, doc);

  const version = versionId
    ? await prisma.documentVersion.findFirst({
        where: { id: versionId, documentId },
      })
    : doc.currentVersion;

  if (!version) {
    throw new AppError(404, "DOC_NOT_FOUND", "Document version not found");
  }

  if (version.encrypted) {
    await writeAudit({
      documentId,
      organizationId,
      actorUserId: userId,
      action: "document.download_url.created",
      metadata: { versionId: version.id, encrypted: true, mode: "proxy" },
    });
    return {
      downloadMode: "proxy" as const,
      encrypted: true,
      proxyPath: `/api/v1/organizations/${organizationId}/documents/${documentId}/content${
        versionId ? `?versionId=${versionId}` : ""
      }`,
      versionId: version.id,
      versionNumber: version.versionNumber,
      contentHash: version.contentHash,
      message: "Envelope-encrypted object; use proxyPath to stream decrypted content",
    };
  }

  const download = await createDownloadUrl({
    objectKey: version.objectKey,
    fileName: version.originalFileName,
  });

  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.download_url.created",
    metadata: { versionId: version.id, encrypted: false },
  });

  return {
    ...download,
    downloadMode: "presigned" as const,
    encrypted: false,
    versionId: version.id,
    versionNumber: version.versionNumber,
    contentHash: version.contentHash,
  };
}

/**
 * Stream decrypted plaintext for envelope-encrypted versions (authorized download).
 * onChunk receives each plaintext chunk plus stable response metadata on every call.
 */
export async function streamDocumentContent(
  userId: string,
  organizationId: string,
  documentId: string,
  versionId: string | undefined,
  onChunk: (
    chunk: Buffer,
    meta: { mimeType: string; fileName: string; encrypted: boolean },
  ) => void,
): Promise<void> {
  const doc = await loadDocument(organizationId, documentId);
  await assertDownloadAllowed(userId, doc);

  const version = versionId
    ? await prisma.documentVersion.findFirst({ where: { id: versionId, documentId } })
    : doc.currentVersion;
  if (!version) {
    throw new AppError(404, "DOC_NOT_FOUND", "Document version not found");
  }

  const meta = {
    mimeType: version.mimeType,
    fileName: version.originalFileName,
    encrypted: version.encrypted,
  };

  if (!version.encrypted) {
    const { getObjectBuffer } = await import("../../integrations/objectStorage.js");
    const obj = await getObjectBuffer(version.objectKey);
    if (!obj.exists || !obj.body) {
      throw new AppError(404, "DOC_NOT_FOUND", "Object not found in storage");
    }
    onChunk(obj.body, meta);
    return;
  }

  if (!version.wrappedDek || !version.iv || !version.authTag || version.keyVersion == null) {
    throw new AppError(500, "DOC_ENCRYPTION_CORRUPT", "Missing encryption metadata");
  }

  const { unwrapDek } = await import("./encryption.js");
  const { streamDecryptObject } = await import("../../integrations/objectStorage.js");
  const dek = unwrapDek(version.wrappedDek, version.keyVersion);
  await streamDecryptObject({
    objectKey: version.objectKey,
    dek,
    iv: version.iv,
    authTag: version.authTag,
    onChunk: (chunk) => onChunk(chunk, meta),
  });
}

// --- Sharing & policies ---

export async function createDocumentShare(
  userId: string,
  organizationId: string,
  documentId: string,
  input: {
    sharedWithUserId?: string;
    sharedWithEmail?: string;
    permission: string;
    expiresAt?: string | null;
  },
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.manage);
  if (doc.deletedAt) throw new AppError(410, "DOC_DELETED", "Document has been deleted");

  const share = await prisma.documentShare.create({
    data: {
      documentId,
      sharedWithUserId: input.sharedWithUserId ?? null,
      sharedWithEmail: input.sharedWithEmail?.toLowerCase() ?? null,
      permission: input.permission,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdById: userId,
    },
  });

  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.share.created",
    metadata: { shareId: share.id, permission: share.permission },
  });

  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.shareCreated,
    entityId: share.id,
    entityType: "document_share",
    title: "Document shared",
    message: `"${doc.title}" was shared (${share.permission}).`,
    metadata: {
      documentId,
      shareId: share.id,
      permission: share.permission,
      sharedWithUserId: share.sharedWithUserId,
      sharedWithEmail: share.sharedWithEmail,
    },
    recipientUserIds: [doc.createdById, share.sharedWithUserId, userId],
  });

  return share;
}

export async function listDocumentShares(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.manage);
  return prisma.documentShare.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeDocumentShare(
  userId: string,
  organizationId: string,
  documentId: string,
  shareId: string,
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.manage);

  const share = await prisma.documentShare.findFirst({
    where: { id: shareId, documentId },
  });
  if (!share) throw new AppError(404, "NOT_FOUND", "Share not found");

  const updated = await prisma.documentShare.update({
    where: { id: shareId },
    data: { revokedAt: new Date() },
  });

  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.share.revoked",
    metadata: { shareId },
  });

  return updated;
}

export async function replaceAccessPolicies(
  userId: string,
  organizationId: string,
  documentId: string,
  policies: Array<{ subjectType: string; subjectId: string; permission: string }>,
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.manage);
  if (doc.deletedAt) throw new AppError(410, "DOC_DELETED", "Document has been deleted");

  await prisma.$transaction(async (tx) => {
    await tx.documentAccessPolicy.deleteMany({ where: { documentId } });
    if (policies.length) {
      await tx.documentAccessPolicy.createMany({
        data: policies.map((p) => ({
          documentId,
          subjectType: p.subjectType,
          subjectId: p.subjectId,
          permission: p.permission,
        })),
      });
    }
  });

  await writeAudit({
    documentId,
    organizationId,
    actorUserId: userId,
    action: "document.access_policies.replaced",
    metadata: { count: policies.length },
  });

  return prisma.documentAccessPolicy.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
  });
}

export async function listAccessPolicies(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.manage);
  return prisma.documentAccessPolicy.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
  });
}

export async function listDocumentAudit(
  userId: string,
  organizationId: string,
  documentId: string,
) {
  const doc = await loadDocument(organizationId, documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.view);

  return prisma.documentAuditEntry.findMany({
    where: { documentId, organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
