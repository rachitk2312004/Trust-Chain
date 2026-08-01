import { QrPrintDefaults, RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";
import { userHasRole } from "../../auth/rbac.repository.js";
import { generateQrPublicCode } from "../utils/payload.js";

async function assertOrgStaff(userId: string, organizationId: string): Promise<void> {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
}

function publicTemplate(row: {
  publicCode: string;
  name: string;
  description: string | null;
  sizePx: number;
  errorCorrection: string;
  foregroundColor: string;
  backgroundColor: string;
  marginModules: number;
  printPageSize: string;
  printDpi: number;
  printMarginMm: number;
  printBleedMm: number;
  qrPerPage: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    publicCode: row.publicCode,
    name: row.name,
    description: row.description,
    sizePx: row.sizePx,
    errorCorrection: row.errorCorrection,
    foregroundColor: row.foregroundColor,
    backgroundColor: row.backgroundColor,
    marginModules: row.marginModules,
    print: {
      pageSize: row.printPageSize,
      dpi: row.printDpi,
      marginMm: row.printMarginMm,
      bleedMm: row.printBleedMm,
      qrPerPage: row.qrPerPage,
    },
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createTemplate(
  userId: string,
  organizationId: string,
  input: {
    name: string;
    description?: string;
    sizePx?: number;
    errorCorrection?: string;
    foregroundColor?: string;
    backgroundColor?: string;
    marginModules?: number;
    printPageSize?: string;
    printDpi?: number;
    printMarginMm?: number;
    printBleedMm?: number;
    qrPerPage?: number;
    isDefault?: boolean;
  },
) {
  await assertOrgStaff(userId, organizationId);
  if (input.isDefault) {
    await prisma.qrTemplate.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }
  const row = await prisma.qrTemplate.create({
    data: {
      publicCode: generateQrPublicCode("QR-TPL"),
      organizationId,
      name: input.name,
      description: input.description,
      sizePx: input.sizePx ?? 512,
      errorCorrection: input.errorCorrection ?? "M",
      foregroundColor: input.foregroundColor ?? "#000000",
      backgroundColor: input.backgroundColor ?? "#FFFFFF",
      marginModules: input.marginModules ?? 4,
      printPageSize: input.printPageSize ?? QrPrintDefaults.pageSize,
      printDpi: input.printDpi ?? QrPrintDefaults.dpi,
      printMarginMm: input.printMarginMm ?? QrPrintDefaults.marginMm,
      printBleedMm: input.printBleedMm ?? QrPrintDefaults.bleedMm,
      qrPerPage: input.qrPerPage ?? QrPrintDefaults.qrPerPage,
      isDefault: input.isDefault ?? false,
      createdByUserId: userId,
    },
  });
  return publicTemplate(row);
}

export async function listTemplates(userId: string, organizationId: string) {
  await assertOrgStaff(userId, organizationId);
  const rows = await prisma.qrTemplate.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(publicTemplate);
}

export async function getTemplate(userId: string, organizationId: string, templateCode: string) {
  await assertOrgStaff(userId, organizationId);
  const row = await prisma.qrTemplate.findFirst({
    where: { organizationId, publicCode: templateCode },
  });
  if (!row) throw new AppError(404, "QR_TEMPLATE_NOT_FOUND", "QR template not found");
  return publicTemplate(row);
}

export async function updateTemplate(
  userId: string,
  organizationId: string,
  templateCode: string,
  input: Partial<{
    name: string;
    description: string;
    sizePx: number;
    errorCorrection: string;
    foregroundColor: string;
    backgroundColor: string;
    marginModules: number;
    printPageSize: string;
    printDpi: number;
    printMarginMm: number;
    printBleedMm: number;
    qrPerPage: number;
    isDefault: boolean;
  }>,
) {
  await assertOrgStaff(userId, organizationId);
  const existing = await prisma.qrTemplate.findFirst({
    where: { organizationId, publicCode: templateCode },
  });
  if (!existing) throw new AppError(404, "QR_TEMPLATE_NOT_FOUND", "QR template not found");
  if (input.isDefault) {
    await prisma.qrTemplate.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }
  const row = await prisma.qrTemplate.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      description: input.description,
      sizePx: input.sizePx,
      errorCorrection: input.errorCorrection,
      foregroundColor: input.foregroundColor,
      backgroundColor: input.backgroundColor,
      marginModules: input.marginModules,
      printPageSize: input.printPageSize,
      printDpi: input.printDpi,
      printMarginMm: input.printMarginMm,
      printBleedMm: input.printBleedMm,
      qrPerPage: input.qrPerPage,
      isDefault: input.isDefault,
    },
  });
  return publicTemplate(row);
}

export async function resolveTemplate(organizationId: string, templatePublicCode?: string) {
  if (templatePublicCode) {
    const t = await prisma.qrTemplate.findFirst({
      where: { organizationId, publicCode: templatePublicCode },
    });
    if (!t) throw new AppError(404, "QR_TEMPLATE_NOT_FOUND", "QR template not found");
    return t;
  }
  return prisma.qrTemplate.findFirst({
    where: { organizationId, isDefault: true },
  });
}
