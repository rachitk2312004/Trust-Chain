const PLACEHOLDER_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export type CertificatePlaceholderContext = {
  certificate_id: string;
  recipient_name: string;
  organization_name: string;
  issue_date: string;
  expiration_date: string;
  verification_url: string;
  title?: string;
  qr_code?: string;
  [key: string]: string | undefined;
};

export type PlaceholderResult = {
  text: string;
  unresolved: string[];
};

/**
 * Replaces `{{placeholders}}`. Unknown keys become empty string and are listed in `unresolved`.
 */
export function applyPlaceholders(
  template: string,
  context: CertificatePlaceholderContext,
): PlaceholderResult {
  const unresolved: string[] = [];
  const text = template.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const normalized = key.toLowerCase();
    const value = context[normalized];
    if (value === undefined) {
      unresolved.push(normalized);
      return "";
    }
    return value;
  });
  return { text, unresolved: [...new Set(unresolved)] };
}

export function formatDisplayDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function buildPlaceholderContext(input: {
  publicId: string;
  recipientName: string;
  organizationName: string;
  issuedAt: Date | string | null;
  expiresAt: Date | string | null;
  verificationUrl: string;
  title?: string;
  qrPublicCode?: string | null;
  metadata?: Record<string, unknown>;
}): CertificatePlaceholderContext {
  const ctx: CertificatePlaceholderContext = {
    certificate_id: input.publicId,
    recipient_name: input.recipientName,
    organization_name: input.organizationName,
    issue_date: formatDisplayDate(input.issuedAt),
    expiration_date: formatDisplayDate(input.expiresAt),
    verification_url: input.verificationUrl,
    title: input.title ?? "",
    qr_code: input.qrPublicCode ?? "",
  };

  if (input.metadata) {
    for (const [key, value] of Object.entries(input.metadata)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        ctx[key.toLowerCase()] = String(value);
      }
    }
  }

  return ctx;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
