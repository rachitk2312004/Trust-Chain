import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { AppError } from "../../lib/errors.js";
import { pageSizePoints } from "./certificates.layout.js";
import {
  CERTIFICATE_FONT_FAMILY,
  resolveCertificateFontFiles,
} from "./certificates.fonts.js";
import {
  buildCertificateRenderModel,
  renderCertificateSvg,
  type CertificateRenderInput,
  type CertificateRenderModel,
} from "./certificates.renderer.js";

export type CertificateExportFormat = "pdf" | "png" | "svg";

export type CertificateExportResult = {
  format: CertificateExportFormat;
  contentType: string;
  fileName: string;
  body: Buffer;
  warnings: string[];
  unresolvedPlaceholders: string[];
};

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 0.1, g: 0.1, b: 0.1 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function wrapPdfText(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/**
 * PDF export via pdf-lib (print-ready), with optional embedded logo/QR/signature images.
 */
export async function exportCertificatePdf(model: CertificateRenderModel): Promise<Buffer> {
  const size = pageSizePoints(model.layout.pageSize, model.layout.orientation);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([size.width, size.height]);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const fontSans = await pdf.embedFont(StandardFonts.Helvetica);

  const bg = hexToRgb01(model.layout.backgroundColor);
  const text = hexToRgb01(model.layout.textColor);
  const accent = hexToRgb01(model.layout.accentColor);
  const border = hexToRgb01(model.layout.borderColor);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    color: rgb(bg.r, bg.g, bg.b),
  });

  if (model.assets.backgroundPng) {
    try {
      const img = await pdf.embedPng(model.assets.backgroundPng);
      page.drawImage(img, {
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
        opacity: 0.12,
      });
    } catch {
      // invalid background — skip
    }
  }

  const margin = 40;
  page.drawRectangle({
    x: margin / 2,
    y: margin / 2,
    width: size.width - margin,
    height: size.height - margin,
    borderColor: rgb(border.r, border.g, border.b),
    borderWidth: 2.5,
  });
  page.drawRectangle({
    x: margin / 2 + 8,
    y: margin / 2 + 8,
    width: size.width - margin - 16,
    height: size.height - margin - 16,
    borderColor: rgb(accent.r, accent.g, accent.b),
    borderWidth: 1,
  });

  const landscape = model.layout.orientation === "landscape";
  const titleSize = landscape ? 26 : 30;
  const subtitleSize = 13;
  const recipientSize = landscape ? 28 : 32;
  const bodySize = 12;
  const maxTextWidth = size.width - margin * 2.4;
  const bodyLines = wrapPdfText(model.body, font, bodySize, maxTextWidth);
  const recipientName = model.context.recipient_name?.trim() || "Recipient";

  let logoH = 0;
  let logoW = 0;
  let logoImg: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  if (model.layout.showLogo && model.assets.logoPng) {
    try {
      logoImg = await pdf.embedPng(model.assets.logoPng);
      const maxW = 110;
      const scale = Math.min(maxW / logoImg.width, 52 / logoImg.height);
      logoW = logoImg.width * scale;
      logoH = logoImg.height * scale;
    } catch {
      logoImg = null;
    }
  }

  const stackH =
    (logoImg ? logoH + 18 : 0) +
    titleSize +
    14 +
    subtitleSize +
    22 +
    recipientSize +
    16 +
    bodyLines.length * 16 +
    20 +
    12;
  const footerReserve = landscape ? 110 : 120;
  const topLimit = size.height - margin - 12;
  const bottomLimit = margin + footerReserve;
  let cursorY = Math.min(topLimit, (topLimit + bottomLimit + stackH) / 2);

  if (logoImg) {
    page.drawImage(logoImg, {
      x: (size.width - logoW) / 2,
      y: cursorY - logoH,
      width: logoW,
      height: logoH,
    });
    cursorY -= logoH + 18;
  }

  const titleWidth = fontBold.widthOfTextAtSize(model.title, titleSize);
  page.drawText(model.title, {
    x: (size.width - titleWidth) / 2,
    y: cursorY - titleSize,
    size: titleSize,
    font: fontBold,
    color: rgb(accent.r, accent.g, accent.b),
  });
  cursorY -= titleSize + 14;

  if (model.subtitle.trim()) {
    const subWidth = font.widthOfTextAtSize(model.subtitle, subtitleSize);
    page.drawText(model.subtitle, {
      x: (size.width - subWidth) / 2,
      y: cursorY - subtitleSize,
      size: subtitleSize,
      font,
      color: rgb(text.r, text.g, text.b),
    });
    cursorY -= subtitleSize + 22;
  }

  const recipientWidth = fontBold.widthOfTextAtSize(recipientName, recipientSize);
  page.drawText(recipientName, {
    x: (size.width - recipientWidth) / 2,
    y: cursorY - recipientSize,
    size: recipientSize,
    font: fontBold,
    color: rgb(text.r, text.g, text.b),
  });
  cursorY -= recipientSize + 6;
  page.drawLine({
    start: { x: size.width * 0.3, y: cursorY },
    end: { x: size.width * 0.7, y: cursorY },
    thickness: 1,
    color: rgb(accent.r, accent.g, accent.b),
    opacity: 0.55,
  });
  cursorY -= 16;

  for (const line of bodyLines) {
    const lineWidth = font.widthOfTextAtSize(line, bodySize);
    page.drawText(line, {
      x: (size.width - lineWidth) / 2,
      y: cursorY - bodySize,
      size: bodySize,
      font,
      color: rgb(text.r, text.g, text.b),
    });
    cursorY -= 16;
  }

  cursorY -= 12;
  const meta = `Issued ${model.context.issue_date} · Valid through ${model.context.expiration_date}`;
  const metaWidth = fontSans.widthOfTextAtSize(meta, 10);
  page.drawText(meta, {
    x: (size.width - metaWidth) / 2,
    y: cursorY - 10,
    size: 10,
    font: fontSans,
    color: rgb(text.r, text.g, text.b),
  });

  const footerBand = margin + 16;
  if (model.layout.showSignature) {
    const sigY = footerBand + 40;
    if (model.assets.signaturePng) {
      try {
        const sig = await pdf.embedPng(model.assets.signaturePng);
        const scale = Math.min(140 / sig.width, 40 / sig.height);
        page.drawImage(sig, {
          x: margin,
          y: sigY,
          width: sig.width * scale,
          height: sig.height * scale,
        });
      } catch {
        page.drawLine({
          start: { x: margin, y: sigY },
          end: { x: margin + 140, y: sigY },
          thickness: 1,
          color: rgb(text.r, text.g, text.b),
        });
      }
    } else {
      page.drawLine({
        start: { x: margin, y: sigY },
        end: { x: margin + 140, y: sigY },
        thickness: 1,
        color: rgb(text.r, text.g, text.b),
      });
    }
    page.drawText(model.layout.signatureLabel, {
      x: margin,
      y: sigY - 14,
      size: 9,
      font: fontSans,
      color: rgb(text.r, text.g, text.b),
    });
  }

  if (model.layout.showQr && model.assets.qrPng) {
    try {
      const qr = await pdf.embedPng(model.assets.qrPng);
      const qrSize = 78;
      page.drawImage(qr, {
        x: size.width - margin - qrSize,
        y: footerBand + 16,
        width: qrSize,
        height: qrSize,
      });
      page.drawText("Scan to verify", {
        x: size.width - margin - qrSize + 4,
        y: footerBand,
        size: 8,
        font: fontSans,
        color: rgb(text.r, text.g, text.b),
      });
    } catch {
      // skip bad QR
    }
  }

  const footerSize = 8;
  const footerMaxWidth = size.width - margin * 2;
  const footerLines = wrapPdfText(model.footer, fontSans, footerSize, footerMaxWidth);
  let footerY = margin + 6;
  for (const line of footerLines.slice().reverse()) {
    const lineWidth = fontSans.widthOfTextAtSize(line, footerSize);
    page.drawText(line, {
      x: Math.max(margin, (size.width - lineWidth) / 2),
      y: footerY,
      size: footerSize,
      font: fontSans,
      color: rgb(text.r, text.g, text.b),
    });
    footerY += 10;
  }

  return Buffer.from(await pdf.save());
}

export async function exportCertificatePng(model: CertificateRenderModel): Promise<Buffer> {
  const svg = renderCertificateSvg(model);
  const fontFiles = resolveCertificateFontFiles();
  try {
    if (fontFiles.length) {
      const resvg = new Resvg(svg, {
        fitTo: { mode: "width", value: model.width },
        font: {
          fontFiles,
          loadSystemFonts: true,
          defaultFontFamily: CERTIFICATE_FONT_FAMILY,
        },
        background: model.layout.backgroundColor,
      });
      return Buffer.from(resvg.render().asPng());
    }
    // Fallback when fonts are missing from the deploy bundle.
    return await sharp(Buffer.from(svg, "utf8")).png().toBuffer();
  } catch (error) {
    throw new AppError(
      500,
      "CERTIFICATE_RENDER_FAILED",
      `PNG rendering failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function exportCertificateSvg(model: CertificateRenderModel): Buffer {
  return Buffer.from(renderCertificateSvg(model), "utf8");
}

export async function exportCertificate(
  input: CertificateRenderInput,
  format: CertificateExportFormat,
  fileBaseName: string,
): Promise<CertificateExportResult> {
  if (format !== "pdf" && format !== "png" && format !== "svg") {
    throw new AppError(400, "UNSUPPORTED_FORMAT", `Unsupported export format: ${String(format)}`);
  }

  const model = buildCertificateRenderModel(input);
  const warnings = [...model.assets.warnings];
  if (model.unresolvedPlaceholders.length) {
    warnings.push(`unresolved_placeholders:${model.unresolvedPlaceholders.join(",")}`);
  }

  try {
    if (format === "svg") {
      return {
        format,
        contentType: "image/svg+xml",
        fileName: `${fileBaseName}.svg`,
        body: exportCertificateSvg(model),
        warnings,
        unresolvedPlaceholders: model.unresolvedPlaceholders,
      };
    }
    if (format === "png") {
      return {
        format,
        contentType: "image/png",
        fileName: `${fileBaseName}.png`,
        body: await exportCertificatePng(model),
        warnings,
        unresolvedPlaceholders: model.unresolvedPlaceholders,
      };
    }
    return {
      format: "pdf",
      contentType: "application/pdf",
      fileName: `${fileBaseName}.pdf`,
      body: await exportCertificatePdf(model),
      warnings,
      unresolvedPlaceholders: model.unresolvedPlaceholders,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      500,
      "CERTIFICATE_RENDER_FAILED",
      `Rendering failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
