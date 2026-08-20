import { CertificateTemplateStatuses } from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { defaultCertificateLayout } from "./certificates.layout.js";

export function toPublicTemplate(row: {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  layoutJson: Prisma.JsonValue;
  status: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    description: row.description,
    layout: row.layoutJson,
    status: row.status,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createTemplate(input: {
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  layoutJson?: Prisma.InputJsonValue;
  createdById: string;
}) {
  return prisma.certificateTemplate.create({
    data: {
      organizationId: input.organizationId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      layoutJson: input.layoutJson ?? defaultCertificateLayout(),
      status: CertificateTemplateStatuses.active,
      createdById: input.createdById,
    },
  });
}

export async function listTemplates(organizationId: string, status?: string) {
  return prisma.certificateTemplate.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function findTemplateById(organizationId: string, templateId: string) {
  return prisma.certificateTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
}

export async function findTemplateByCode(organizationId: string, code: string) {
  return prisma.certificateTemplate.findFirst({
    where: { organizationId, code },
  });
}

export async function updateTemplate(
  templateId: string,
  data: {
    name?: string;
    description?: string | null;
    layoutJson?: Prisma.InputJsonValue;
    status?: string;
  },
) {
  return prisma.certificateTemplate.update({
    where: { id: templateId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.layoutJson !== undefined ? { layoutJson: data.layoutJson } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
}

/** Default layout used when no template is provided. */
export { defaultCertificateLayout, resolveCertificateLayout } from "./certificates.layout.js";

