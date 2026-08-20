import { useEffect, useState } from "react";
import { Button, FormError, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import { useFeedback } from "../../hooks/useFeedback";
import { getNotificationErrorMessage } from "../../lib/notificationErrors";
import type { NotificationPreference } from "../../types/api";
import { eventLabel } from "./NotificationFilters";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "./hooks";

export function NotificationPreferences() {
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const feedback = useFeedback();
  const [draft, setDraft] = useState<NotificationPreference[]>([]);

  useEffect(() => {
    if (prefs.data?.preferences) {
      setDraft(prefs.data.preferences);
    }
  }, [prefs.data]);

  function toggle(eventType: string, field: "inAppEnabled" | "emailEnabled") {
    setDraft((prev) =>
      prev.map((row) =>
        row.eventType === eventType ? { ...row, [field]: !row[field] } : row,
      ),
    );
  }

  function onSave() {
    update.mutate(
      draft.map((row) => ({
        eventType: row.eventType,
        inAppEnabled: row.inAppEnabled,
        emailEnabled: row.emailEnabled,
        organizationId: row.organizationId,
      })),
      {
        onSuccess: () => feedback.success("Notification preferences saved"),
        onError: (err) => feedback.error(err, "Could not save preferences"),
      },
    );
  }

  if (prefs.isLoading) {
    return <p className="text-sm text-[var(--tc-muted)]">Loading preferences…</p>;
  }

  if (prefs.isError) {
    return <FormError>{getNotificationErrorMessage(prefs.error)}</FormError>;
  }

  return (
    <div className="flex flex-col gap-4">
      <FormHint>
        Choose which events deliver in-app alerts and email (email delivery uses the outbox).
      </FormHint>
      <Table>
        <THead>
          <TR>
            <TH>Event</TH>
            <TH>In-app</TH>
            <TH>Email</TH>
          </TR>
        </THead>
        <TBody>
          {draft.map((row) => (
            <TR key={row.eventType}>
              <TD>
                <div className="font-medium">{row.label ?? eventLabel(row.eventType)}</div>
                <div className="text-xs text-[var(--tc-muted)]">{row.eventType}</div>
              </TD>
              <TD>
                <input
                  type="checkbox"
                  checked={row.inAppEnabled}
                  onChange={() => toggle(row.eventType, "inAppEnabled")}
                  aria-label={`In-app for ${row.eventType}`}
                />
              </TD>
              <TD>
                <input
                  type="checkbox"
                  checked={row.emailEnabled}
                  onChange={() => toggle(row.eventType, "emailEnabled")}
                  aria-label={`Email for ${row.eventType}`}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <FormError>{update.error ? getNotificationErrorMessage(update.error) : null}</FormError>
      <Button className="self-start" disabled={update.isPending} onClick={onSave}>
        {update.isPending ? "Saving…" : "Save preferences"}
      </Button>
    </div>
  );
}
