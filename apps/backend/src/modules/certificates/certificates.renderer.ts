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

  const title = applyPlaceholders(input.layout.titleTemplate || input.title, context);
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

/**
 * Renders a printable certificate as SVG (logos/QR embedded as data URIs when present).
 */
export function renderCertificateSvg(model: CertificateRenderModel): string {
  const { width, height, layout } = model;
  const margin = Math.round(Math.min(width, height) * 0.06);

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

  const bodyLines = wrapSvgText(model.body, layout.orientation === "landscape" ? 70 : 52);
  const titleY = margin + (logoUri ? 140 : 90);
  const subtitleY = titleY + 48;
  const bodyStart = subtitleY + 56;

  const bodyTspans = bodyLines
    .map(
      (line, i) =>
        `<tspan x="${width / 2}" dy="${i === 0 ? 0 : 28}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  const qrSize = Math.round(Math.min(width, height) * 0.16);
  const qrX = width - margin - qrSize;
  const qrY = height - margin - qrSize - 24;

  const sigY = height - margin - 70;
  const metaY = bodyStart + bodyLines.length * 28 + 48;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${escapeXml(layout.backgroundColor)}"/>
  ${bgUri ? `<image href="${bgUri}" x="0" y="0" width="${width}" height="${height}" opacity="0.12" preserveAspectRatio="xMidYMid slice"/>` : ""}
  <rect x="${margin / 2}" y="${margin / 2}" width="${width - margin}" height="${height - margin}" fill="none" stroke="${escapeXml(layout.borderColor)}" stroke-width="3"/>
  <rect x="${margin / 2 + 8}" y="${margin / 2 + 8}" width="${width - margin - 16}" height="${height - margin - 16}" fill="none" stroke="${escapeXml(layout.accentColor)}" stroke-width="1.5" opacity="0.7"/>
  ${logoUri ? `<image href="${logoUri}" x="${(width - 120) / 2}" y="${margin}" width="120" height="80" preserveAspectRatio="xMidYMid meet"/>` : ""}
  <text x="${width / 2}" y="${titleY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="42" font-weight="600" fill="${escapeXml(layout.accentColor)}">${escapeXml(model.title)}</text>
  <text x="${width / 2}" y="${subtitleY}" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="${escapeXml(layout.textColor)}">${escapeXml(model.subtitle)}</text>
  <text x="${width / 2}" y="${bodyStart}" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="${escapeXml(layout.textColor)}">${bodyTspans}</text>
  <text x="${width / 2}" y="${metaY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="${escapeXml(layout.textColor)}">Issued ${escapeXml(model.context.issue_date)} · Expires ${escapeXml(model.context.expiration_date)}</text>
  ${
    layout.showSignature
      ? `<g>
    ${sigUri ? `<image href="${sigUri}" x="${margin}" y="${sigY - 50}" width="160" height="50" preserveAspectRatio="xMinYMid meet"/>` : `<line x1="${margin}" y1="${sigY}" x2="${margin + 180}" y2="${sigY}" stroke="${escapeXml(layout.textColor)}" stroke-width="1"/>`}
    <text x="${margin}" y="${sigY + 22}" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="${escapeXml(layout.textColor)}">${escapeXml(layout.signatureLabel)}</text>
  </g>`
      : ""
  }
  ${
    layout.showQr && qrUri
      ? `<g>
    <image href="${qrUri}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}"/>
    <text x="${qrX + qrSize / 2}" y="${qrY + qrSize + 18}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="${escapeXml(layout.textColor)}">Scan to verify</text>
  </g>`
      : ""
  }
  <text x="${width / 2}" y="${height - margin / 2 - 8}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="${escapeXml(layout.textColor)}">${escapeXml(model.footer)}</text>
</svg>`;
}
