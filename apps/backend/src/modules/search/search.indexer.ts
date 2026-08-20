import { SearchEntityTypes, type SearchEntityType } from "@trustchain/config";
import type { SearchableDocument } from "./search.scoring.js";

function joinKeywords(parts: Array<string | null | undefined>): string {
  return parts
    .filter((p): p is string => Boolean(p && String(p).trim()))
    .map((p) => String(p).trim().toLowerCase())
    .join(" ");
}

function joinExact(parts: Array<string | null | undefined>): string {
  return parts
    .filter((p): p is string => Boolean(p && String(p).trim()))
    .map((p) => String(p).trim().toLowerCase())
    .join(" ");
}

export function indexDocument(row: {
  id: string;
  organizationId: string;
  title: string;
  description?: string | null;
  status: string;
  publicVerifyCode?: string | null;
  createdAt: Date | string;
}): SearchableDocument {
  return {
    entityType: SearchEntityTypes.document,
    entityId: row.id,
    organizationId: row.organizationId,
    title: row.title,
    subtitle: row.description ?? null,
    status: row.status,
    keywords: joinKeywords([row.title, row.description, row.status, row.publicVerifyCode]),
    exactKeys: joinExact([row.id, row.publicVerifyCode]),
    createdAtRef: row.createdAt,
  };
}

export function indexCertificate(row: {
  id: string;
  organizationId: string;
  publicId: string;
  title: string;
  description?: string | null;
  recipientName: string;
  recipientEmail?: string | null;
  status: string;
  createdAt: Date | string;
}): SearchableDocument {
  return {
    entityType: SearchEntityTypes.certificate,
    entityId: row.id,
    organizationId: row.organizationId,
    title: row.title,
    subtitle: row.recipientName,
    status: row.status,
    keywords: joinKeywords([
      row.title,
      row.description,
      row.recipientName,
      row.recipientEmail,
      row.publicId,
      row.status,
    ]),
    exactKeys: joinExact([row.id, row.publicId, row.recipientEmail]),
    createdAtRef: row.createdAt,
  };
}

export function indexSignature(row: {
  id: string;
  organizationId: string;
  publicId: string;
  status: string;
  algorithm?: string | null;
  documentTitle?: string | null;
  createdAt: Date | string;
}): SearchableDocument {
  return {
    entityType: SearchEntityTypes.signature,
    entityId: row.id,
    organizationId: row.organizationId,
    title: row.publicId,
    subtitle: row.documentTitle ?? row.algorithm ?? null,
    status: row.status,
    keywords: joinKeywords([row.publicId, row.status, row.algorithm, row.documentTitle]),
    exactKeys: joinExact([row.id, row.publicId]),
    createdAtRef: row.createdAt,
  };
}

export function indexUser(row: {
  id: string;
  organizationId?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
  createdAt: Date | string;
}): SearchableDocument {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  return {
    entityType: SearchEntityTypes.user,
    entityId: row.id,
    organizationId: row.organizationId ?? null,
    title: name || row.email,
    subtitle: row.email,
    status: row.status,
    keywords: joinKeywords([row.email, row.firstName, row.lastName, row.status, name]),
    exactKeys: joinExact([row.id, row.email]),
    createdAtRef: row.createdAt,
  };
}

export function indexOrganization(row: {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date | string;
}): SearchableDocument {
  return {
    entityType: SearchEntityTypes.organization,
    entityId: row.id,
    organizationId: row.id,
    title: row.name,
    subtitle: row.slug,
    status: row.status,
    keywords: joinKeywords([row.name, row.slug, row.status]),
    exactKeys: joinExact([row.id, row.slug]),
    createdAtRef: row.createdAt,
  };
}

export function indexAuditEvent(row: {
  id: string;
  organizationId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  success: boolean;
  createdAt: Date | string;
}): SearchableDocument {
  return {
    entityType: SearchEntityTypes.auditEvent,
    entityId: row.id,
    organizationId: row.organizationId ?? null,
    title: row.action,
    subtitle: row.targetType ? `${row.targetType}${row.targetId ? `:${row.targetId}` : ""}` : null,
    status: row.success ? "success" : "failure",
    keywords: joinKeywords([
      row.action,
      row.targetType,
      row.targetId,
      row.success ? "success" : "failure",
    ]),
    exactKeys: joinExact([row.id, row.targetId, row.action]),
    createdAtRef: row.createdAt,
  };
}

export function buildIndexDocuments(
  entityType: SearchEntityType,
  rows: unknown[],
): SearchableDocument[] {
  switch (entityType) {
    case SearchEntityTypes.document:
      return (rows as Parameters<typeof indexDocument>[0][]).map(indexDocument);
    case SearchEntityTypes.certificate:
      return (rows as Parameters<typeof indexCertificate>[0][]).map(indexCertificate);
    case SearchEntityTypes.signature:
      return (rows as Parameters<typeof indexSignature>[0][]).map(indexSignature);
    case SearchEntityTypes.user:
      return (rows as Parameters<typeof indexUser>[0][]).map(indexUser);
    case SearchEntityTypes.organization:
      return (rows as Parameters<typeof indexOrganization>[0][]).map(indexOrganization);
    case SearchEntityTypes.auditEvent:
      return (rows as Parameters<typeof indexAuditEvent>[0][]).map(indexAuditEvent);
    default:
      return [];
  }
}

export function filterIndexDocuments(
  docs: SearchableDocument[],
  filters: {
    entityTypes?: string[];
    status?: string;
    organizationId?: string;
    from?: string;
    to?: string;
  },
): SearchableDocument[] {
  return docs.filter((doc) => {
    if (filters.entityTypes?.length && !filters.entityTypes.includes(doc.entityType)) {
      return false;
    }
    if (filters.status && doc.status !== filters.status) return false;
    if (filters.organizationId && doc.organizationId !== filters.organizationId) return false;
    const created = new Date(doc.createdAtRef).getTime();
    if (filters.from && created < new Date(filters.from).getTime()) return false;
    if (filters.to && created > new Date(filters.to).getTime()) return false;
    return true;
  });
}
