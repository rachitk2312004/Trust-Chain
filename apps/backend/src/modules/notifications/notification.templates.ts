import { NotificationEventTypes } from "@trustchain/config";
import type { NotificationEventType } from "./notification.events.js";

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

type TemplateInput = {
  eventType: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  recipientName?: string | null;
};

const SUBJECTS: Record<string, string> = {
  [NotificationEventTypes.invitationCreated]: "You're invited to join an organization",
  [NotificationEventTypes.invitationAccepted]: "Invitation accepted",
  [NotificationEventTypes.memberAdded]: "New member added",
  [NotificationEventTypes.documentUploaded]: "Document uploaded",
  [NotificationEventTypes.documentVerified]: "Document verified",
  [NotificationEventTypes.documentArchived]: "Document archived",
  [NotificationEventTypes.documentRestored]: "Document restored",
  [NotificationEventTypes.shareCreated]: "Document shared with you",
  [NotificationEventTypes.qrCreated]: "QR code generated",
  [NotificationEventTypes.qrRevoked]: "QR code revoked",
  [NotificationEventTypes.verificationCompleted]: "Verification completed",
  [NotificationEventTypes.certificateIssued]: "You received a certificate",
  [NotificationEventTypes.certificateRevoked]: "Certificate revoked",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metaLine(metadata?: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  const bits: string[] = [];
  for (const key of [
    "certificateTitle",
    "publicId",
    "verificationUrl",
    "myCertificatesUrl",
    "revokeReason",
    "entityType",
    "entityId",
    "organizationId",
    "actorId",
  ] as const) {
    const v = metadata[key];
    if (typeof v === "string" && v.length > 0) bits.push(`${key}: ${v}`);
  }
  return bits.length ? `\n\n${bits.join("\n")}` : "";
}

/**
 * Renders a transactional email for a supported notification event.
 */
export function renderNotificationEmail(input: TemplateInput): RenderedEmail {
  const subject = SUBJECTS[input.eventType] ?? input.title;
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hi,";
  const text = `${greeting}\n\n${input.title}\n\n${input.message}${metaLine(input.metadata)}\n\n— TrustChain`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#f7f4ef;color:#1a1a1a;padding:24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e2d8;">
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 16px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#6b6358;">TrustChain</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;">${escapeHtml(input.title)}</h1>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">${escapeHtml(greeting)}</p>
      <p style="margin:0;font-size:16px;line-height:1.6;">${escapeHtml(input.message)}</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export function renderDigestEmail(input: {
  mode: "daily" | "weekly";
  items: Array<{ title: string; message: string; eventType: string; createdAt?: string }>;
  recipientName?: string | null;
}): RenderedEmail {
  const label = input.mode === "daily" ? "Daily" : "Weekly";
  const subject = `TrustChain ${label} digest (${input.items.length})`;
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hi,";
  const lines = input.items.map(
    (item, i) => `${i + 1}. [${item.eventType}] ${item.title} — ${item.message}`,
  );
  const text = `${greeting}\n\nYour ${label.toLowerCase()} notification digest:\n\n${lines.join("\n")}\n\n— TrustChain`;

  const listHtml = input.items
    .map(
      (item) =>
        `<li style="margin:0 0 12px;"><strong>${escapeHtml(item.title)}</strong><br/><span style="color:#6b6358;">${escapeHtml(item.message)}</span></li>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#f7f4ef;color:#1a1a1a;padding:24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e2d8;">
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 16px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#6b6358;">TrustChain</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;">${escapeHtml(label)} digest</h1>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">${escapeHtml(greeting)}</p>
      <ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.5;">${listHtml}</ul>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export function supportedTemplateEventTypes(): NotificationEventType[] {
  return Object.keys(SUBJECTS) as NotificationEventType[];
}
