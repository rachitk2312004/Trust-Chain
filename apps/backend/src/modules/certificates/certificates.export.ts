import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { AppError } from "../../lib/errors.js";
import { pageSizePoints } from "./certificates.layout.js";
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

  const margin = 36;
  page.drawRectangle({
    x: margin / 2,
    y: margin / 2,
    width: size.width - margin,
    height: size.height - margin,
    borderColor: rgb(border.r, border.g, border.b),
    borderWidth: 2,
  });
  page.drawRectangle({
    x: margin / 2 + 6,
    y: margin / 2 + 6,
    width: size.width - margin - 12,
    height: size.height - margin - 12,
    borderColor: rgb(accent.r, accent.g, accent.b),
    borderWidth: 1,
  });

  let cursorY = size.height - margin - 24;

  if (model.layout.showLogo && model.assets.logoPng) {
    try {
      const logo = await pdf.embedPng(model.assets.logoPng);
      const maxW = 120;
      const scale = Math.min(maxW / logo.width, 60 / logo.height);
      const w = logo.width * scale;
      const h = logo.height * scale;
      page.drawImage(logo, {
        x: (size.width - w) / 2,
        y: cursorY - h,
        width: w,
        height: h,
      });
      cursorY -= h + 24;
    } catch {
      // skip bad logo
    }
  }

  const titleSize = 28;
  const titleWidth = fontBold.widthOfTextAtSize(model.title, titleSize);
  page.drawText(model.title, {
    x: (size.width - titleWidth) / 2,
    y: cursorY,
    size: titleSize,
    font: fontBold,
    color: rgb(accent.r, accent.g, accent.b),
  });
  cursorY -= 36;

  const subSize = 14;
  const subWidth = font.widthOfTextAtSize(model.subtitle, subSize);
  page.drawText(model.subtitle, {
    x: (size.width - subWidth) / 2,
    y: cursorY,
    size: subSize,
    font,
    color: rgb(text.r, text.g, text.b),
  });
  cursorY -= 40;

  const maxTextWidth = size.width - margin * 2;
  const bodyLines = wrapPdfText(model.body, font, 12, maxTextWidth);
  for (const line of bodyLines) {
    const lineWidth = font.widthOfTextAtSize(line, 12);
    page.drawText(line, {
      x: (size.width - lineWidth) / 2,
      y: cursorY,
      size: 12,
      font,
      color: rgb(text.r, text.g, text.b),
    });
    cursorY -= 18;
  }

  cursorY -= 16;
  const meta = `Issued ${model.context.issue_date} · Expires ${model.context.expiration_date}`;
  const metaWidth = fontSans.widthOfTextAtSize(meta, 10);
  page.drawText(meta, {
    x: (size.width - metaWidth) / 2,
    y: cursorY,
    size: 10,
    font: fontSans,
    color: rgb(text.r, text.g, text.b),
  });

  if (model.layout.showSignature) {
    const sigY = margin + 50;
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
      const qrSize = 90;
      page.drawImage(qr, {
        x: size.width - margin - qrSize,
        y: margin + 20,
        width: qrSize,
        height: qrSize,
      });
      page.drawText("Scan to verify", {
        x: size.width - margin - qrSize + 8,
        y: margin + 8,
        size: 8,
        font: fontSans,
        color: rgb(text.r, text.g, text.b),
      });
    } catch {
      // skip bad QR
    }
  }

  const footerWidth = fontSans.widthOfTextAtSize(model.footer, 8);
  page.drawText(model.footer, {
    x: Math.max(margin, (size.width - footerWidth) / 2),
    y: margin / 2 + 4,
    size: 8,
    font: fontSans,
    color: rgb(text.r, text.g, text.b),
    maxWidth: size.width - margin * 2,
  });

  return Buffer.from(await pdf.save());
}

export async function exportCertificatePng(model: CertificateRenderModel): Promise<Buffer> {
  const svg = renderCertificateSvg(model);
  try {
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
