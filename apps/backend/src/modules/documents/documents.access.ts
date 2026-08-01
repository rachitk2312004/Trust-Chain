import { DocumentAccessSubjectTypes, DocumentPermissions, RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { listRoleBindingsForUser } from "../auth/rbac.repository.js";

export type DocumentPermission = (typeof DocumentPermissions)[keyof typeof DocumentPermissions];

const RANK: Record<DocumentPermission, number> = {
  [DocumentPermissions.view]: 1,
  [DocumentPermissions.download]: 2,
  [DocumentPermissions.edit]: 3,
  [DocumentPermissions.manage]: 4,
};

export function permissionAtLeast(
  have: DocumentPermission | null,
  need: DocumentPermission,
): boolean {
  if (!have) return false;
  return RANK[have] >= RANK[need];
}

export function maxPermission(
  a: DocumentPermission | null,
  b: DocumentPermission | null,
): DocumentPermission | null {
  if (!a) return b;
  if (!b) return a;
  return RANK[a] >= RANK[b] ? a : b;
}

export type DocumentAccessContext = {
  id: string;
  organizationId: string;
  createdById: string;
  status: string;
  deletedAt: Date | null;
  expiresAt: Date | null;
  archivedAt: Date | null;
};

export async function resolveDocumentPermission(
  userId: string,
  document: DocumentAccessContext,
): Promise<DocumentPermission | null> {
  if (document.deletedAt) {
    const isAdmin = await userHasRole(
      userId,
      [RoleKeys.superAdmin, RoleKeys.orgAdmin],
      document.organizationId,
    );
    return isAdmin || document.createdById === userId ? DocumentPermissions.manage : null;
  }

  if (document.createdById === userId) {
    return DocumentPermissions.manage;
  }

  const isAdmin = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    document.organizationId,
  );
  if (isAdmin) {
    return DocumentPermissions.manage;
  }

  let effective: DocumentPermission | null = null;

  const now = new Date();
  const shares = await prisma.documentShare.findMany({
    where: {
      documentId: document.id,
      revokedAt: null,
      OR: [{ sharedWithUserId: userId }, { sharedWithEmail: { not: null } }],
    },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  for (const share of shares) {
    const matchesUser = share.sharedWithUserId === userId;
    const matchesEmail =
      share.sharedWithEmail != null &&
      user?.email != null &&
      share.sharedWithEmail.toLowerCase() === user.email.toLowerCase();
    if (!matchesUser && !matchesEmail) continue;
    if (share.expiresAt && share.expiresAt <= now) continue;
    if ((Object.values(DocumentPermissions) as string[]).includes(share.permission)) {
      effective = maxPermission(effective, share.permission as DocumentPermission);
    }
  }

  const bindings = await listRoleBindingsForUser(userId);
  const roleKeys = bindings
    .filter(
      (b) =>
        b.roleKey === RoleKeys.superAdmin ||
        b.organizationId === document.organizationId ||
        b.organizationId == null,
    )
    .map((b) => b.roleKey);

  const policies = await prisma.documentAccessPolicy.findMany({
    where: { documentId: document.id },
  });

  for (const policy of policies) {
    if (!(Object.values(DocumentPermissions) as string[]).includes(policy.permission)) {
      continue;
    }
    const perm = policy.permission as DocumentPermission;
    if (policy.subjectType === DocumentAccessSubjectTypes.user && policy.subjectId === userId) {
      effective = maxPermission(effective, perm);
    }
    if (
      policy.subjectType === DocumentAccessSubjectTypes.role &&
      roleKeys.includes(policy.subjectId)
    ) {
      effective = maxPermission(effective, perm);
    }
    if (
      policy.subjectType === DocumentAccessSubjectTypes.organization &&
      policy.subjectId === document.organizationId
    ) {
      effective = maxPermission(effective, perm);
    }
  }

  return effective;
}

export async function assertDocumentPermission(
  userId: string,
  document: DocumentAccessContext,
  need: DocumentPermission,
): Promise<DocumentPermission> {
  const have = await resolveDocumentPermission(userId, document);
  if (!permissionAtLeast(have, need)) {
    throw new AppError(403, "DOC_FORBIDDEN", "Insufficient document permission", {
      need,
      have,
    });
  }
  return have!;
}

export function assertDocumentReadableState(document: DocumentAccessContext): void {
  if (document.deletedAt) {
    throw new AppError(410, "DOC_DELETED", "Document has been deleted");
  }
  if (document.status === "archived" || document.archivedAt) {
    // archived is still readable for view/download; callers decide
  }
  if (document.expiresAt && document.expiresAt <= new Date() && document.status !== "archived") {
    // treat as expired for mutating download of "active" content — callers check
  }
}

export function isDocumentExpired(document: DocumentAccessContext): boolean {
  return Boolean(document.expiresAt && document.expiresAt <= new Date());
}
