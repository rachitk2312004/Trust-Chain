import { prisma } from "@trustchain/database";
import { getObjectBuffer } from "../../integrations/objectStorage.js";
import { generatePngBuffer, generateSvgString } from "../qr/generators/qrGenerator.js";

export type CertificateRenderAssets = {
  logoPng: Buffer | null;
  logoMissing: boolean;
  signaturePng: Buffer | null;
  signatureMissing: boolean;
  backgroundPng: Buffer | null;
  backgroundMissing: boolean;
  qrPng: Buffer | null;
  qrSvg: string | null;
  qrMissing: boolean;
  warnings: string[];
};

async function safeGetObject(objectKey: string | null | undefined): Promise<Buffer | null> {
  if (!objectKey) return null;
  try {
    const result = await getObjectBuffer(objectKey);
    if (!result.exists || !result.body) return null;
    return result.body;
  } catch {
    return null;
  }
}

/**
 * Loads branding/logo/signature/background from R2 and prepares QR artwork.
 * Missing assets are non-fatal — warnings are collected.
 */
export async function loadCertificateAssets(input: {
  organizationId: string;
  verificationUrl: string;
  qrPublicCode?: string | null;
  logoObjectKey?: string | null;
  signatureImageKey?: string | null;
  backgroundImageKey?: string | null;
  showQr: boolean;
  showLogo: boolean;
  showSignature: boolean;
}): Promise<CertificateRenderAssets> {
  const warnings: string[] = [];

  const branding = await prisma.organizationBranding.findUnique({
    where: { organizationId: input.organizationId },
  });

  const logoKey = input.logoObjectKey ?? branding?.logoObjectKey ?? null;
  let logoPng: Buffer | null = null;
  let logoMissing = false;
  if (input.showLogo) {
    if (!logoKey) {
      logoMissing = true;
      warnings.push("missing_logo");
    } else {
      logoPng = await safeGetObject(logoKey);
      if (!logoPng) {
        logoMissing = true;
        warnings.push("missing_logo_asset");
      }
    }
  }

  let signaturePng: Buffer | null = null;
  let signatureMissing = false;
  if (input.showSignature && input.signatureImageKey) {
    signaturePng = await safeGetObject(input.signatureImageKey);
    if (!signaturePng) {
      signatureMissing = true;
      warnings.push("missing_signature_asset");
    }
  } else if (input.showSignature && !input.signatureImageKey) {
    // Signature line without image is OK.
    signatureMissing = false;
  }

  let backgroundPng: Buffer | null = null;
  let backgroundMissing = false;
  if (input.backgroundImageKey) {
    backgroundPng = await safeGetObject(input.backgroundImageKey);
    if (!backgroundPng) {
      backgroundMissing = true;
      warnings.push("missing_background_asset");
    }
  }

  let qrPng: Buffer | null = null;
  let qrSvg: string | null = null;
  let qrMissing = false;

  if (input.showQr) {
    try {
      if (input.qrPublicCode) {
        const qrRow = await prisma.documentQrCode.findFirst({
          where: {
            organizationId: input.organizationId,
            publicCode: input.qrPublicCode,
          },
        });
        if (qrRow?.pngObjectKey) {
          qrPng = await safeGetObject(qrRow.pngObjectKey);
        }
      }
      if (!qrPng) {
        qrPng = await generatePngBuffer(input.verificationUrl, {
          sizePx: 256,
          marginModules: 2,
          foregroundColor: "#1C1917",
          backgroundColor: "#FFFFFF",
        });
      }
      qrSvg = await generateSvgString(input.verificationUrl, {
        sizePx: 256,
        marginModules: 2,
        foregroundColor: "#1C1917",
        backgroundColor: "#FFFFFF",
      });
    } catch {
      qrMissing = true;
      warnings.push("qr_embed_failed");
    }
  }

  return {
    logoPng,
    logoMissing,
    signaturePng,
    signatureMissing,
    backgroundPng,
    backgroundMissing,
    qrPng,
    qrSvg,
    qrMissing,
    warnings,
  };
}

export function bufferToDataUri(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
