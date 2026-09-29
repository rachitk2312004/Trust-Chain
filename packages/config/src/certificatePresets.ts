export const CertificateLayoutPresetIds = [
  "classic-gold",
  "portrait-honor",
  "imperial-navy",
  "emerald-merit",
  "academic-crimson",
  "modern-slate",
] as const;

export type CertificateLayoutPresetId = (typeof CertificateLayoutPresetIds)[number];

export type CertificateLayoutPresetLayout = {
  version: number;
  preset: CertificateLayoutPresetId;
  orientation: "portrait" | "landscape";
  pageSize: "A4" | "Letter";
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
  fields: string[];
};

export type CertificateLayoutPreset = {
  id: CertificateLayoutPresetId;
  code: string;
  name: string;
  description: string;
  layout: CertificateLayoutPresetLayout;
};

const FIELDS = ["title", "recipientName", "issuedAt", "expiresAt", "publicId"];

export const CERTIFICATE_LAYOUT_PRESETS: CertificateLayoutPreset[] = [
  {
    id: "classic-gold",
    code: "classic-gold",
    name: "Classic Gold",
    description: "Landscape A4 · ceremonial double frame with warm parchment field.",
    layout: {
      version: 1,
      preset: "classic-gold",
      orientation: "landscape",
      pageSize: "A4",
      backgroundColor: "#FBF6EA",
      textColor: "#2A2118",
      accentColor: "#9A6B1F",
      borderColor: "#C4A35A",
      titleTemplate: "Certificate of Achievement",
      subtitleTemplate: "{{organization_name}}",
      bodyTemplate:
        "This is to certify that the bearer named below has fulfilled all requirements and is recognized for distinguished accomplishment.",
      footerTemplate: "Certificate {{certificate_id}} · Verify at {{verification_url}}",
      showQr: true,
      showLogo: true,
      showSignature: true,
      signatureLabel: "Authorized signature",
      fields: FIELDS,
    },
  },
  {
    id: "portrait-honor",
    code: "portrait-honor",
    name: "Portrait Honor",
    description: "Portrait A4 · formal vertical diploma with generous margins for framing.",
    layout: {
      version: 1,
      preset: "portrait-honor",
      orientation: "portrait",
      pageSize: "A4",
      backgroundColor: "#FFFDF8",
      textColor: "#1C1917",
      accentColor: "#92400E",
      borderColor: "#D6C7A1",
      titleTemplate: "Certificate of Honor",
      subtitleTemplate: "Conferred by {{organization_name}}",
      bodyTemplate:
        "In recognition of outstanding contribution and integrity, this credential is awarded on {{issue_date}} with validity through {{expiration_date}}.",
      footerTemplate: "ID {{certificate_id}} · {{verification_url}}",
      showQr: true,
      showLogo: true,
      showSignature: true,
      signatureLabel: "Registrar",
      fields: FIELDS,
    },
  },
  {
    id: "imperial-navy",
    code: "imperial-navy",
    name: "Imperial Navy",
    description: "Landscape A4 · corporate header band with balanced signature and QR columns.",
    layout: {
      version: 1,
      preset: "imperial-navy",
      orientation: "landscape",
      pageSize: "A4",
      backgroundColor: "#F7F8FB",
      textColor: "#0F172A",
      accentColor: "#1E3A5F",
      borderColor: "#94A3B8",
      titleTemplate: "Certificate of Excellence",
      subtitleTemplate: "{{organization_name}} · Official record",
      bodyTemplate:
        "This document attests that the individual named below has demonstrated professional excellence and is duly recorded as a credential holder.",
      footerTemplate: "{{certificate_id}} · Authenticate at {{verification_url}}",
      showQr: true,
      showLogo: true,
      showSignature: true,
      signatureLabel: "Director",
      fields: FIELDS,
    },
  },
  {
    id: "emerald-merit",
    code: "emerald-merit",
    name: "Emerald Merit",
    description: "Portrait A4 · completion certificate with calm green accent panel.",
    layout: {
      version: 1,
      preset: "emerald-merit",
      orientation: "portrait",
      pageSize: "A4",
      backgroundColor: "#F4F7F4",
      textColor: "#14532D",
      accentColor: "#047857",
      borderColor: "#86EFAC",
      titleTemplate: "Certificate of Completion",
      subtitleTemplate: "{{organization_name}}",
      bodyTemplate:
        "Has successfully completed the designated program and met all required standards of competence and conduct.",
      footerTemplate: "Issued {{issue_date}} · {{certificate_id}}",
      showQr: true,
      showLogo: true,
      showSignature: true,
      signatureLabel: "Program lead",
      fields: FIELDS,
    },
  },
  {
    id: "academic-crimson",
    code: "academic-crimson",
    name: "Academic Crimson",
    description: "Landscape A4 · scholarly ribbon layout for academic distinction.",
    layout: {
      version: 1,
      preset: "academic-crimson",
      orientation: "landscape",
      pageSize: "A4",
      backgroundColor: "#FFF8F6",
      textColor: "#3F1D1D",
      accentColor: "#9F1239",
      borderColor: "#FDA4AF",
      titleTemplate: "Academic Distinction",
      subtitleTemplate: "Awarded by {{organization_name}}",
      bodyTemplate:
        "In witness of scholarly merit, dedicated study, and fulfillment of institutional requirements, this distinction is hereby conferred.",
      footerTemplate: "{{certificate_id}} · Verify {{verification_url}}",
      showQr: true,
      showLogo: true,
      showSignature: true,
      signatureLabel: "Dean / Registrar",
      fields: FIELDS,
    },
  },
  {
    id: "modern-slate",
    code: "modern-slate",
    name: "Modern Slate",
    description: "Portrait Letter · contemporary credential with side accent and clean typography.",
    layout: {
      version: 1,
      preset: "modern-slate",
      orientation: "portrait",
      pageSize: "Letter",
      backgroundColor: "#FFFFFF",
      textColor: "#1E293B",
      accentColor: "#0F766E",
      borderColor: "#CBD5E1",
      titleTemplate: "Professional Credential",
      subtitleTemplate: "{{organization_name}}",
      bodyTemplate:
        "Is hereby granted this professional credential in recognition of verified competence, standing, and completion of stated requirements.",
      footerTemplate: "{{certificate_id}} · {{verification_url}}",
      showQr: true,
      showLogo: true,
      showSignature: true,
      signatureLabel: "Authorized officer",
      fields: FIELDS,
    },
  },
];

export function certificateLayoutPresetById(
  id: string | undefined,
): CertificateLayoutPreset | undefined {
  return CERTIFICATE_LAYOUT_PRESETS.find((preset) => preset.id === id);
}

export function defaultCertificateLayoutPreset(): CertificateLayoutPreset {
  return CERTIFICATE_LAYOUT_PRESETS[1]!;
}
