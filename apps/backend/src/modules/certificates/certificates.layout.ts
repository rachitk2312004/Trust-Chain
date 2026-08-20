export type CertificateOrientation = "portrait" | "landscape";
export type CertificatePageSize = "A4" | "Letter";

export type CertificateLayoutConfig = {
  version: number;
  orientation: CertificateOrientation;
  pageSize: CertificatePageSize;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  borderColor: string;
  titleTemplate: string;
  subtitleTemplate: string;
  bodyTemplate: string;
  footerTemplate: string;
  showQr: boolean;
  showLogo: boolean;
  showSignature: boolean;
  signatureLabel: string;
  /** Optional R2 object keys override branding / defaults. */
  backgroundImageKey?: string | null;
  logoObjectKey?: string | null;
  signatureImageKey?: string | null;
  fields: string[];
};

/** Page size in points (pdf-lib / print). */
export const CERTIFICATE_PAGE_SIZES_PT: Record<
  CertificatePageSize,
  { width: number; height: number }
> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
};

/** Pixel size for SVG/PNG raster (150 DPI approx). */
export function pageSizePixels(
  pageSize: CertificatePageSize,
  orientation: CertificateOrientation,
  dpi = 150,
): { width: number; height: number } {
  const pt = CERTIFICATE_PAGE_SIZES_PT[pageSize];
  const wIn = pt.width / 72;
  const hIn = pt.height / 72;
  const width = Math.round(wIn * dpi);
  const height = Math.round(hIn * dpi);
  if (orientation === "landscape") {
    return { width: height, height: width };
  }
  return { width, height };
}

export function pageSizePoints(
  pageSize: CertificatePageSize,
  orientation: CertificateOrientation,
): { width: number; height: number } {
  const base = CERTIFICATE_PAGE_SIZES_PT[pageSize];
  if (orientation === "landscape") {
    return { width: base.height, height: base.width };
  }
  return { width: base.width, height: base.height };
}

export function defaultCertificateLayout(): CertificateLayoutConfig {
  return {
    version: 1,
    orientation: "portrait",
    pageSize: "A4",
    backgroundColor: "#FFFDF8",
    textColor: "#1C1917",
    accentColor: "#B45309",
    borderColor: "#D6D3D1",
    titleTemplate: "Certificate of Achievement",
    subtitleTemplate: "{{organization_name}}",
    bodyTemplate:
      "This certifies that {{recipient_name}} has been awarded this certificate ({{certificate_id}}).",
    footerTemplate: "Verify at {{verification_url}}",
    showQr: true,
    showLogo: true,
    showSignature: true,
    signatureLabel: "Authorized signature",
    backgroundImageKey: null,
    logoObjectKey: null,
    signatureImageKey: null,
    fields: ["title", "recipientName", "issuedAt", "expiresAt", "publicId"],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Merges template layoutJson with defaults. Invalid orientation/pageSize fall back safely.
 */
export function resolveCertificateLayout(layoutJson: unknown): CertificateLayoutConfig {
  const defaults = defaultCertificateLayout();
  const raw = asRecord(layoutJson);

  const orientationRaw = asString(raw.orientation, defaults.orientation);
  const orientation: CertificateOrientation =
    orientationRaw === "landscape" ? "landscape" : "portrait";

  const pageSizeRaw = asString(raw.pageSize, defaults.pageSize);
  const pageSize: CertificatePageSize = pageSizeRaw === "Letter" ? "Letter" : "A4";

  const fields = Array.isArray(raw.fields)
    ? raw.fields.filter((f): f is string => typeof f === "string")
    : defaults.fields;

  return {
    version: typeof raw.version === "number" ? raw.version : defaults.version,
    orientation,
    pageSize,
    backgroundColor: asString(raw.backgroundColor, defaults.backgroundColor),
    textColor: asString(raw.textColor, defaults.textColor),
    accentColor: asString(raw.accentColor, defaults.accentColor),
    borderColor: asString(raw.borderColor, defaults.borderColor),
    titleTemplate: asString(raw.titleTemplate, defaults.titleTemplate),
    subtitleTemplate: asString(raw.subtitleTemplate, defaults.subtitleTemplate),
    bodyTemplate: asString(raw.bodyTemplate, defaults.bodyTemplate),
    footerTemplate: asString(raw.footerTemplate, defaults.footerTemplate),
    showQr: asBool(raw.showQr, defaults.showQr),
    showLogo: asBool(raw.showLogo, defaults.showLogo),
    showSignature: asBool(raw.showSignature, defaults.showSignature),
    signatureLabel: asString(raw.signatureLabel, defaults.signatureLabel),
    backgroundImageKey:
      typeof raw.backgroundImageKey === "string" ? raw.backgroundImageKey : null,
    logoObjectKey: typeof raw.logoObjectKey === "string" ? raw.logoObjectKey : null,
    signatureImageKey:
      typeof raw.signatureImageKey === "string" ? raw.signatureImageKey : null,
    fields,
  };
}
