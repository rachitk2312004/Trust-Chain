import QRCode from "qrcode";
import { PDFDocument, rgb } from "pdf-lib";
import type { QrRenderOptions, QrTemplatePrintOptions } from "../types/qr.types.js";

const DEFAULT_RENDER: QrRenderOptions = {
  sizePx: 512,
  errorCorrection: "M",
  foregroundColor: "#000000",
  backgroundColor: "#FFFFFF",
  marginModules: 4,
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export async function generatePngBuffer(
  wire: string,
  options: Partial<QrRenderOptions> = {},
): Promise<Buffer> {
  const opts = { ...DEFAULT_RENDER, ...options };
  const dark = hexToRgb(opts.foregroundColor);
  const light = hexToRgb(opts.backgroundColor);
  return QRCode.toBuffer(wire, {
    type: "png",
    width: opts.sizePx,
    margin: opts.marginModules,
    errorCorrectionLevel: opts.errorCorrection,
    color: {
      dark: `#${[dark.r, dark.g, dark.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
      light: `#${[light.r, light.g, light.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
    },
  });
}

export async function generateSvgString(
  wire: string,
  options: Partial<QrRenderOptions> = {},
): Promise<string> {
  const opts = { ...DEFAULT_RENDER, ...options };
  return QRCode.toString(wire, {
    type: "svg",
    width: opts.sizePx,
    margin: opts.marginModules,
    errorCorrectionLevel: opts.errorCorrection,
    color: {
      dark: opts.foregroundColor,
      light: opts.backgroundColor,
    },
  });
}

export async function generateBase64Png(
  wire: string,
  options: Partial<QrRenderOptions> = {},
): Promise<string> {
  const buf = await generatePngBuffer(wire, options);
  return buf.toString("base64");
}

/** A4 page size in points (1pt = 1/72"). */
const PAGE_SIZES_PT: Record<string, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
};

function mmToPoints(mm: number): number {
  return (mm * 72) / 25.4;
}

/**
 * Print-optimized PDF: places QR image(s) on A4 (or Letter) with margin + bleed.
 * DPI informs preferred raster size; PNG is embedded as-is.
 */
export async function generatePrintPdf(input: {
  pngBuffers: Buffer[];
  print: Partial<QrTemplatePrintOptions>;
  labels?: string[];
}): Promise<Buffer> {
  const pageSize = input.print.printPageSize ?? "A4";
  const size = PAGE_SIZES_PT[pageSize] ?? PAGE_SIZES_PT.A4!;
  const marginMm = input.print.printMarginMm ?? 10;
  const bleedMm = input.print.printBleedMm ?? 3;
  const qrPerPage = Math.max(1, input.print.qrPerPage ?? 1);
  const margin = mmToPoints(marginMm + bleedMm);

  const pdf = await PDFDocument.create();
  let index = 0;
  while (index < input.pngBuffers.length) {
    const page = pdf.addPage([size.width, size.height]);
    const usableW = size.width - margin * 2;
    const usableH = size.height - margin * 2;
    const cols = Math.ceil(Math.sqrt(qrPerPage));
    const rows = Math.ceil(qrPerPage / cols);
    const cellW = usableW / cols;
    const cellH = usableH / rows;

    for (let slot = 0; slot < qrPerPage && index < input.pngBuffers.length; slot++, index++) {
      const img = await pdf.embedPng(input.pngBuffers[index]!);
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const pad = Math.min(cellW, cellH) * 0.08;
      const maxSide = Math.min(cellW, cellH) - pad * 2;
      const scale = Math.min(maxSide / img.width, maxSide / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = margin + col * cellW + (cellW - w) / 2;
      const y = size.height - margin - (row + 1) * cellH + (cellH - h) / 2;
      page.drawImage(img, { x, y, width: w, height: h });
      const label = input.labels?.[index - 1];
      if (label) {
        page.drawText(label.slice(0, 40), {
          x,
          y: y - 14,
          size: 8,
          color: rgb(0.2, 0.2, 0.2),
        });
      }
    }
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
