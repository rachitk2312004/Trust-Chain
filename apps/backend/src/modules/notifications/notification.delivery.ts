import { NotificationChannels, NotificationOutboxStatuses } from "@trustchain/config";
import { sendEmail } from "../../integrations/mailer.js";
import { findUserById } from "../auth/users.repository.js";
import { renderDigestEmail, renderNotificationEmail } from "./notification.templates.js";
import type { DigestMode } from "./notification.digest.js";

export type OutboxDeliveryItem = {
  id: string;
  userId: string;
  channel: string;
  eventType: string;
  payloadJson: unknown;
  notificationId: string | null;
};

export type DeliveryResult =
  | { ok: true; channel: string }
  | { ok: false; channel: string; error: string; permanent?: boolean };

function payloadFields(payload: unknown): {
  title: string;
  message: string;
  metadata: Record<string, unknown>;
} {
  const p = (payload ?? {}) as {
    title?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  };
  return {
    title: typeof p.title === "string" ? p.title : "TrustChain notification",
    message: typeof p.message === "string" ? p.message : "",
    metadata: p.metadata ?? {},
  };
}

/**
 * Executes delivery for a claimed outbox row (in_app or email).
 * in_app is treated as already persisted in the inbox — mark success without SMTP.
 */
export async function deliverOutboxItem(item: OutboxDeliveryItem): Promise<DeliveryResult> {
  if (item.channel === NotificationChannels.inApp) {
    return { ok: true, channel: NotificationChannels.inApp };
  }

  if (item.channel !== NotificationChannels.email) {
    return {
      ok: false,
      channel: item.channel,
      error: `unsupported_channel:${item.channel}`,
      permanent: true,
    };
  }

  const user = await findUserById(item.userId);
  if (!user?.email) {
    return {
      ok: false,
      channel: NotificationChannels.email,
      error: "recipient_not_found_or_missing_email",
      permanent: true,
    };
  }

  const fields = payloadFields(item.payloadJson);
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
  const rendered = renderNotificationEmail({
    eventType: item.eventType,
    title: fields.title,
    message: fields.message,
    metadata: fields.metadata,
    recipientName: name,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    return { ok: true, channel: NotificationChannels.email };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, channel: NotificationChannels.email, error: message };
  }
}

export async function deliverDigestEmail(input: {
  userId: string;
  mode: Exclude<DigestMode, "immediate">;
  items: Array<{ title: string; message: string; eventType: string; createdAt?: string }>;
}): Promise<DeliveryResult> {
  const user = await findUserById(input.userId);
  if (!user?.email) {
    return {
      ok: false,
      channel: NotificationChannels.email,
      error: "recipient_not_found_or_missing_email",
      permanent: true,
    };
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
  const rendered = renderDigestEmail({
    mode: input.mode,
    items: input.items,
    recipientName: name,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    return { ok: true, channel: NotificationChannels.email };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, channel: NotificationChannels.email, error: message };
  }
}

export const TERMINAL_SUCCESS_STATUSES = new Set([
  NotificationOutboxStatuses.sent,
  NotificationOutboxStatuses.delivered,
  NotificationOutboxStatuses.skipped,
  NotificationOutboxStatuses.deadLetter,
]);
