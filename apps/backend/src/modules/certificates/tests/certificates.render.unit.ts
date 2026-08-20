import assert from "node:assert/strict";
import {
  applyPlaceholders,
  buildPlaceholderContext,
  formatDisplayDate,
} from "../certificates.placeholders.js";
import {
  defaultCertificateLayout,
  pageSizePixels,
  pageSizePoints,
  resolveCertificateLayout,
} from "../certificates.layout.js";
import {
  buildCertificateRenderModel,
  renderCertificateSvg,
} from "../certificates.renderer.js";
import {
  exportCertificatePdf,
  exportCertificatePng,
  exportCertificateSvg,
} from "../certificates.export.js";
import type { CertificateRenderAssets } from "../certificates.assets.js";

const emptyAssets: CertificateRenderAssets = {
  logoPng: null,
  logoMissing: false,
  signaturePng: null,
  signatureMissing: false,
  backgroundPng: null,
  backgroundMissing: false,
  qrPng: null,
  qrSvg: null,
  qrMissing: false,
  warnings: [],
};

function sampleModel(overrides?: { orientation?: "portrait" | "landscape"; showQr?: boolean }) {
  const layout = resolveCertificateLayout({
    ...defaultCertificateLayout(),
    orientation: overrides?.orientation ?? "portrait",
    showQr: overrides?.showQr ?? true,
    titleTemplate: "Award for {{recipient_name}}",
    bodyTemplate:
      "{{recipient_name}} ({{certificate_id}}) · {{organization_name}} · {{issue_date}} · {{expiration_date}} · {{verification_url}} · {{unknown_field}}",
  });
  return buildCertificateRenderModel({
    publicId: "CERT-TEST-001",
    title: "Achievement",
    recipientName: "Ada Lovelace",
    organizationName: "TrustChain Org",
    issuedAt: new Date("2026-08-03T00:00:00.000Z"),
    expiresAt: new Date("2027-08-03T00:00:00.000Z"),
    verificationUrl: "https://verify.example/CERT-TEST-001",
    qrPublicCode: "QR-ABC",
    layout,
    assets: emptyAssets,
  });
}

export function testPlaceholderReplacement(): void {
  const ctx = buildPlaceholderContext({
    publicId: "CERT-1",
    recipientName: "Ada",
    organizationName: "Acme",
    issuedAt: new Date("2026-01-15T00:00:00.000Z"),
    expiresAt: null,
    verificationUrl: "https://v.example/1",
  });
  const result = applyPlaceholders(
    "ID={{certificate_id}}; name={{recipient_name}}; org={{organization_name}}; issue={{issue_date}}; exp={{expiration_date}}; url={{verification_url}}; bad={{nope}}",
    ctx,
  );
  assert.match(result.text, /ID=CERT-1/);
  assert.match(result.text, /name=Ada/);
  assert.match(result.text, /org=Acme/);
  assert.match(result.text, /url=https:\/\/v\.example\/1/);
  assert.ok(result.unresolved.includes("nope"));
  assert.equal(formatDisplayDate(null), "—");
}

export function testLayoutRendering(): void {
  const portrait = resolveCertificateLayout({ orientation: "portrait", pageSize: "A4" });
  const landscape = resolveCertificateLayout({ orientation: "landscape", pageSize: "A4" });
  const pPx = pageSizePixels(portrait.pageSize, portrait.orientation);
  const lPx = pageSizePixels(landscape.pageSize, landscape.orientation);
  assert.ok(pPx.height > pPx.width);
  assert.ok(lPx.width > lPx.height);

  const pPt = pageSizePoints("A4", "portrait");
  const lPt = pageSizePoints("A4", "landscape");
  assert.equal(pPt.width, lPt.height);
  assert.equal(pPt.height, lPt.width);

  const model = sampleModel({ orientation: "landscape" });
  const svg = renderCertificateSvg(model);
  assert.match(svg, /<svg /);
  assert.match(svg, /Ada Lovelace/);
  assert.match(svg, /CERT-TEST-001/);
  assert.ok(model.unresolvedPlaceholders.includes("unknown_field"));
}

export async function testSvgGeneration(): Promise<void> {
  const model = sampleModel();
  const buf = exportCertificateSvg(model);
  const text = buf.toString("utf8");
  assert.match(text, /Certificate|Award/);
  assert.match(text, /verification_url|verify\.example|Scan to verify|Award for/);
}

export async function testPdfGeneration(): Promise<void> {
  const model = sampleModel();
  const pdf = await exportCertificatePdf(model);
  assert.ok(pdf.length > 100);
  assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF");
}

export async function testPngGeneration(): Promise<void> {
  const model = sampleModel();
  const png = await exportCertificatePng(model);
  assert.ok(png.length > 100);
  // PNG magic bytes
  assert.equal(png[0], 0x89);
  assert.equal(png[1], 0x50);
  assert.equal(png[2], 0x4e);
  assert.equal(png[3], 0x47);
}

export async function testQrEmbedding(): Promise<void> {
  const { generatePngBuffer } = await import("../../qr/generators/qrGenerator.js");
  const qrPng = await generatePngBuffer("https://verify.example/CERT-QR", { sizePx: 128 });
  const layout = resolveCertificateLayout({
    ...defaultCertificateLayout(),
    showQr: true,
    bodyTemplate: "Verify {{verification_url}}",
  });
  const model = buildCertificateRenderModel({
    publicId: "CERT-QR",
    title: "QR Cert",
    recipientName: "Bob",
    organizationName: "Org",
    issuedAt: new Date(),
    expiresAt: null,
    verificationUrl: "https://verify.example/CERT-QR",
    layout,
    assets: { ...emptyAssets, qrPng },
  });
  const svg = renderCertificateSvg(model);
  assert.match(svg, /data:image\/png;base64,/);
  assert.match(svg, /Scan to verify/);

  const pdf = await exportCertificatePdf(model);
  assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF");
  assert.ok(pdf.length > 500);
}
