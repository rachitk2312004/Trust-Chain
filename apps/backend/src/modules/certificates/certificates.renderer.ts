import type { CertificateLayoutConfig } from "./certificates.layout.js";
import { pageSizePixels } from "./certificates.layout.js";
import {
  applyPlaceholders,
  buildPlaceholderContext,
  escapeXml,
  type CertificatePlaceholderContext,
} from "./certificates.placeholders.js";
import { bufferToDataUri, type CertificateRenderAssets } from "./certificates.assets.js";

export type CertificateRenderModel = {
  width: number;
  height: number;
  layout: CertificateLayoutConfig;
  context: CertificatePlaceholderContext;
  title: string;
  subtitle: string;
  body: string;
  footer: string;
  unresolvedPlaceholders: string[];
  assets: CertificateRenderAssets;
  branding: {
    primaryColor: string | null;
    secondaryColor: string | null;
    displayName: string | null;
  };
};

export type CertificateRenderInput = {
  publicId: string;
  title: string;
  recipientName: string;
  organizationName: string;
  issuedAt: Date | string | null;
  expiresAt: Date | string | null;
  verificationUrl: string;
  qrPublicCode?: string | null;
  metadata?: Record<string, unknown>;
  layout: CertificateLayoutConfig;
  assets: CertificateRenderAssets;
  branding?: {
    primaryColor?: string | null;
    secondaryColor?: string | null;
    displayName?: string | null;
  };
};

/**
 * Builds the resolved text model used by SVG/PDF/PNG exporters.
 */
export function buildCertificateRenderModel(input: CertificateRenderInput): CertificateRenderModel {
  const context = buildPlaceholderContext({
    publicId: input.publicId,
    recipientName: input.recipientName,
    organizationName: input.organizationName,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    verificationUrl: input.verificationUrl,
    title: input.title,
    qrPublicCode: input.qrPublicCode,
    metadata: input.metadata,
  });

  // Prefer the issued/preview title; fall back to template string with placeholders.
  const titleSource = input.title.trim() || input.layout.titleTemplate || "Certificate";
  const title = applyPlaceholders(titleSource, context);
  const subtitle = applyPlaceholders(input.layout.subtitleTemplate, context);
  const body = applyPlaceholders(input.layout.bodyTemplate, context);
  const footer = applyPlaceholders(input.layout.footerTemplate, context);

  const unresolved = [
    ...title.unresolved,
    ...subtitle.unresolved,
    ...body.unresolved,
    ...footer.unresolved,
  ];

  const size = pageSizePixels(input.layout.pageSize, input.layout.orientation);
  const accent =
    input.branding?.primaryColor && /^#[0-9a-fA-F]{3,8}$/.test(input.branding.primaryColor)
      ? input.branding.primaryColor
      : input.layout.accentColor;

  const layout: CertificateLayoutConfig = {
    ...input.layout,
    accentColor: accent,
  };

  return {
    width: size.width,
    height: size.height,
    layout,
    context,
    title: title.text,
    subtitle: subtitle.text,
    body: body.text,
    footer: footer.text,
    unresolvedPlaceholders: [...new Set(unresolved)],
    assets: input.assets,
    branding: {
      primaryColor: input.branding?.primaryColor ?? null,
      secondaryColor: input.branding?.secondaryColor ?? null,
      displayName: input.branding?.displayName ?? null,
    },
  };
}

function wrapSvgText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

type Geometry = {
  margin: number;
  titleY: number;
  subtitleY: number;
  recipientY: number;
  bodyStart: number;
  bodyLineHeight: number;
  metaY: number;
  sigY: number;
  qrSize: number;
  qrX: number;
  qrY: number;
  titleSize: number;
  subtitleSize: number;
  recipientSize: number;
  bodySize: number;
  maxBodyChars: number;
  logoY: number;
};

function computeGeometry(
  model: CertificateRenderModel,
  hasLogo: boolean,
): Geometry {
  const { width, height, layout } = model;
  const landscape = layout.orientation === "landscape";
  const margin = Math.round(Math.min(width, height) * (landscape ? 0.06 : 0.08));

  const titleSize = landscape ? 30 : 36;
  const subtitleSize = landscape ? 16 : 18;
  const recipientSize = landscape ? 42 : 48;
  const bodySize = landscape ? 15 : 16;
  const bodyLineHeight = landscape ? 22 : 24;
  const maxBodyChars = landscape ? 68 : 50;

  const bodyLines = wrapSvgText(model.body, maxBodyChars);
  const logoH = hasLogo ? 78 : 0;
  const stackH =
    logoH +
    titleSize +
    18 +
    subtitleSize +
    28 +
    recipientSize +
    18 +
    bodyLines.length * bodyLineHeight +
    28 +
    14;

  const footerReserve = Math.round(height * (landscape ? 0.24 : 0.22));
  const availableTop = margin + 8;
  const availableBottom = height - footerReserve;
  let cursor = Math.max(availableTop, (availableTop + availableBottom - stackH) / 2);

  const logoY = cursor;
  if (hasLogo) cursor += logoH + 10;
  const titleY = cursor + titleSize * 0.85;
  cursor = titleY + 18;
  const subtitleY = cursor + subtitleSize;
  cursor = subtitleY + 28;
  const recipientY = cursor + recipientSize * 0.8;
  cursor = recipientY + 20;
  const bodyStart = cursor + bodySize;
  const metaY = bodyStart + bodyLines.length * bodyLineHeight + 22;

  const qrSize = Math.round(Math.min(width, height) * (landscape ? 0.12 : 0.14));
  const qrX = width - margin - qrSize;
  const qrY = height - margin - qrSize - 28;
  const sigY = height - margin - 64;

  return {
    margin,
    titleY,
    subtitleY,
    recipientY,
    bodyStart,
    bodyLineHeight,
    metaY,
    sigY,
    qrSize,
    qrX,
    qrY,
    titleSize,
    subtitleSize,
    recipientSize,
    bodySize,
    maxBodyChars,
    logoY,
  };
}

function presetDecorations(
  layout: CertificateLayoutConfig,
  width: number,
  height: number,
  margin: number,
): string {
  const preset = layout.preset ?? "";
  const accent = escapeXml(layout.accentColor);
  const border = escapeXml(layout.borderColor);
  const inner = margin / 2;
  const outerW = width - margin;
  const outerH = height - margin;

  const doubleFrame = `
  <rect x="${inner}" y="${inner}" width="${outerW}" height="${outerH}" fill="none" stroke="${border}" stroke-width="3"/>
  <rect x="${inner + 10}" y="${inner + 10}" width="${outerW - 20}" height="${outerH - 20}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.85"/>`;

  switch (preset) {
    case "classic-gold": {
      const c = inner + 18;
      const corners = [
        [c, c],
        [width - c, c],
        [c, height - c],
        [width - c, height - c],
      ];
      const cornerMarks = corners
        .map(
          ([cx, cy]) =>
            `<path d="M ${cx} ${cy} l 28 0 l 0 28 M ${cx} ${cy} l 0 28 l 28 0" fill="none" stroke="${accent}" stroke-width="2"/>`,
        )
        .join("");
      return `${doubleFrame}${cornerMarks}`;
    }
    case "portrait-honor":
      return `${doubleFrame}
  <line x1="${margin * 1.4}" y1="${margin * 1.8}" x2="${width - margin * 1.4}" y2="${margin * 1.8}" stroke="${accent}" stroke-width="1"/>
  <line x1="${margin * 1.4}" y1="${height - margin * 1.6}" x2="${width - margin * 1.4}" y2="${height - margin * 1.6}" stroke="${accent}" stroke-width="1"/>`;
    case "imperial-navy": {
      const bandH = Math.round(margin * 1.35);
      return `${doubleFrame}
  <rect x="0" y="0" width="${width}" height="${bandH}" fill="${accent}" opacity="0.1"/>
  <rect x="${inner}" y="${inner + bandH - 8}" width="${outerW}" height="4" fill="${accent}" opacity="0.35"/>`;
    }
    case "emerald-merit": {
      const barW = Math.round(margin * 0.55);
      return `${doubleFrame}
  <rect x="${inner}" y="${inner}" width="${barW}" height="${outerH}" fill="${accent}" opacity="0.12" rx="2"/>`;
    }
    case "academic-crimson": {
      const ribbonY = inner + 52;
      return `${doubleFrame}
  <rect x="${width * 0.22}" y="${ribbonY}" width="${width * 0.56}" height="36" fill="${accent}" opacity="0.14" rx="4"/>`;
    }
    case "modern-slate": {
      const barW = Math.round(margin * 0.45);
      return `
  <rect x="${inner}" y="${inner}" width="${outerW}" height="${outerH}" fill="none" stroke="${border}" stroke-width="1"/>
  <rect x="${inner}" y="${inner}" width="${barW}" height="${outerH}" fill="${accent}" opacity="0.9"/>
  <rect x="${inner + barW + 6}" y="${inner + 6}" width="${outerW - barW - 12}" height="${outerH - 12}" fill="none" stroke="${border}" stroke-width="1"/>`;
    }
    default:
      return doubleFrame;
  }
}

/**
 * Renders a printable certificate as SVG (logos/QR embedded as data URIs when present).
 */
export function renderCertificateSvg(model: CertificateRenderModel): string {
  const { width, height, layout } = model;

  const logoUri = model.assets.logoPng
    ? bufferToDataUri(model.assets.logoPng, "image/png")
    : null;
  const bgUri = model.assets.backgroundPng
    ? bufferToDataUri(model.assets.backgroundPng, "image/png")
    : null;
  const sigUri = model.assets.signaturePng
    ? bufferToDataUri(model.assets.signaturePng, "image/png")
    : null;
  const qrUri = model.assets.qrPng ? bufferToDataUri(model.assets.qrPng, "image/png") : null;

  const geo = computeGeometry(model, Boolean(logoUri && layout.showLogo));
  const bodyLines = wrapSvgText(model.body, geo.maxBodyChars);

  const bodyTspans = bodyLines
    .map(
      (line, i) =>
        `<tspan x="${width / 2}" dy="${i === 0 ? 0 : geo.bodyLineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  const logoBlock =
    logoUri && layout.showLogo
      ? `<image href="${logoUri}" x="${(width - 140) / 2}" y="${geo.logoY}" width="140" height="70" preserveAspectRatio="xMidYMid meet"/>`
      : "";

  const recipient = escapeXml(model.context.recipient_name?.trim() || "Recipient");
  // Generic CSS families only — named fonts (Times/Helvetica) are missing on Linux
  // sharp/librsvg hosts and render as tofu boxes (□) in the PNG preview.
  const serif = "serif";
  const sans = "sans-serif";
  const footerY = height - geo.margin - 10;
  const issuedLine = `Issued ${escapeXml(model.context.issue_date)} · Valid through ${escapeXml(model.context.expiration_date)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${escapeXml(layout.backgroundColor)}"/>
  ${bgUri ? `<image href="${bgUri}" x="0" y="0" width="${width}" height="${height}" opacity="0.1" preserveAspectRatio="xMidYMid slice"/>` : ""}
  ${presetDecorations(layout, width, height, geo.margin)}
  ${logoBlock}
  <text x="${width / 2}" y="${geo.titleY}" text-anchor="middle" font-family="${serif}" font-size="${geo.titleSize}" font-weight="700" letter-spacing="1.2" fill="${escapeXml(layout.accentColor)}">${escapeXml(model.title)}</text>
  <text x="${width / 2}" y="${geo.subtitleY}" text-anchor="middle" font-family="${serif}" font-size="${geo.subtitleSize}" fill="${escapeXml(layout.textColor)}" opacity="0.9">${escapeXml(model.subtitle)}</text>
  <text x="${width / 2}" y="${geo.recipientY}" text-anchor="middle" font-family="${serif}" font-size="${geo.recipientSize}" font-weight="700" fill="${escapeXml(layout.textColor)}">${recipient}</text>
  <line x1="${width * 0.3}" y1="${geo.recipientY + 12}" x2="${width * 0.7}" y2="${geo.recipientY + 12}" stroke="${escapeXml(layout.accentColor)}" stroke-width="1.25" opacity="0.55"/>
  <text x="${width / 2}" y="${geo.bodyStart}" text-anchor="middle" font-family="${serif}" font-size="${geo.bodySize}" fill="${escapeXml(layout.textColor)}">${bodyTspans}</text>
  <text x="${width / 2}" y="${geo.metaY}" text-anchor="middle" font-family="${sans}" font-size="12" fill="${escapeXml(layout.textColor)}" opacity="0.85">${issuedLine}</text>
  ${
    layout.showSignature
      ? `<g>
    ${sigUri ? `<image href="${sigUri}" x="${geo.margin}" y="${geo.sigY - 48}" width="168" height="48" preserveAspectRatio="xMinYMid meet"/>` : `<line x1="${geo.margin}" y1="${geo.sigY}" x2="${geo.margin + 200}" y2="${geo.sigY}" stroke="${escapeXml(layout.textColor)}" stroke-width="1"/>`}
    <text x="${geo.margin}" y="${geo.sigY + 18}" font-family="${sans}" font-size="11" fill="${escapeXml(layout.textColor)}">${escapeXml(layout.signatureLabel)}</text>
  </g>`
      : ""
  }
  ${
    layout.showQr && qrUri
      ? `<g>
    <image href="${qrUri}" x="${geo.qrX}" y="${geo.qrY}" width="${geo.qrSize}" height="${geo.qrSize}"/>
    <text x="${geo.qrX + geo.qrSize / 2}" y="${geo.qrY + geo.qrSize + 14}" text-anchor="middle" font-family="${sans}" font-size="10" fill="${escapeXml(layout.textColor)}">Scan to verify</text>
  </g>`
      : ""
  }
  <text x="${width / 2}" y="${footerY}" text-anchor="middle" font-family="${sans}" font-size="9" fill="${escapeXml(layout.textColor)}" opacity="0.8">${escapeXml(model.footer)}</text>
</svg>`;
}
