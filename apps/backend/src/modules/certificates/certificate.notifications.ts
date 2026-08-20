import { NotificationEventTypes } from "@trustchain/config";
import { sendEmail } from "../../integrations/mailer.js";
import { findUserById } from "../auth/users.repository.js";
import { myCertificatesUrl } from "../../lib/appUrls.js";
import { emitDomainNotification } from "../notifications/notification.emit.js";
import { renderNotificationEmail } from "../notifications/notification.templates.js";

export type CertificateHolderNotifyInput = {
  organizationId: string;
  actorId: string;
  certificateId: string;
  publicId: string;
  title: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientUserId?: string | null;
  verificationUrl: string;
  revokeReason?: string | null;
};

async function resolveHolderEmail(input: CertificateHolderNotifyInput): Promise<string | null> {
  if (input.recipientEmail?.trim()) return input.recipientEmail.trim();
  if (!input.recipientUserId) return null;
  const user = await findUserById(input.recipientUserId);
  return user?.email ?? null;
}

async function sendHolderEmail(
  input: CertificateHolderNotifyInput,
  eventType: typeof NotificationEventTypes.certificateIssued | typeof NotificationEventTypes.certificateRevoked,
  title: string,
  message: string,
): Promise<void> {
  const to = await resolveHolderEmail(input);
  if (!to) return;

  const rendered = renderNotificationEmail({
    eventType,
    title,
    message,
    recipientName: input.recipientName,
    metadata: {
      publicId: input.publicId,
      verificationUrl: input.verificationUrl,
      myCertificatesUrl: myCertificatesUrl(),
      certificateTitle: input.title,
      revokeReason: input.revokeReason ?? undefined,
    },
  });

  try {
    await sendEmail({
      to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
  } catch (error) {
    console.error("[certificates] holder email failed", {
      publicId: input.publicId,
      to,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyCertificateIssuedToHolder(input: CertificateHolderNotifyInput): Promise<void> {
  const message = [
    `You received "${input.title}" (${input.publicId}).`,
    `View it in My certificates: ${myCertificatesUrl()}`,
    `Verify publicly: ${input.verificationUrl}`,
  ].join("\n");

  if (input.recipientUserId) {
    await emitDomainNotification({
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: NotificationEventTypes.certificateIssued,
      entityId: input.certificateId,
      entityType: "certificate",
      title: "You received a certificate",
      message,
      metadata: {
        publicId: input.publicId,
        verificationUrl: input.verificationUrl,
        myCertificatesUrl: myCertificatesUrl(),
        certificateTitle: input.title,
        holder: true,
      },
      recipientUserIds: [input.recipientUserId],
      recipientsOnly: true,
    });
  }

  await sendHolderEmail(
    input,
    NotificationEventTypes.certificateIssued,
    "You received a certificate",
    message,
  );
}

export async function notifyCertificateRevokedToHolder(input: CertificateHolderNotifyInput): Promise<void> {
  const message = [
    `Your certificate "${input.title}" (${input.publicId}) was revoked.`,
    input.revokeReason ? `Reason: ${input.revokeReason}` : "",
    `Verify status: ${input.verificationUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (input.recipientUserId) {
    await emitDomainNotification({
      organizationId: input.organizationId,
      actorId: input.actorId,
      eventType: NotificationEventTypes.certificateRevoked,
      entityId: input.certificateId,
      entityType: "certificate",
      title: "Certificate revoked",
      message,
      metadata: {
        publicId: input.publicId,
        verificationUrl: input.verificationUrl,
        revokeReason: input.revokeReason ?? null,
        holder: true,
      },
      recipientUserIds: [input.recipientUserId],
      recipientsOnly: true,
    });
  }

  await sendHolderEmail(
    input,
    NotificationEventTypes.certificateRevoked,
    "Certificate revoked",
    message,
  );
}

export async function notifyCertificateIssuedToStaff(input: {
  organizationId: string;
  actorId: string;
  certificateId: string;
  publicId: string;
  recipientName: string;
}): Promise<void> {
  await emitDomainNotification({
    organizationId: input.organizationId,
    actorId: input.actorId,
    eventType: NotificationEventTypes.certificateIssued,
    entityId: input.certificateId,
    entityType: "certificate",
    title: "Certificate issued",
    message: `Certificate ${input.publicId} was issued to ${input.recipientName}.`,
    metadata: { publicId: input.publicId, recipientName: input.recipientName },
    recipientUserIds: [input.actorId],
  });
}
