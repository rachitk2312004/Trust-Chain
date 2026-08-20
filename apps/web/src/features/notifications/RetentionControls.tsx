import { useState } from "react";
import { Button, Card, CardDescription, CardHeader, CardTitle, FormHint, Input } from "@trustchain/ui";
import type { RetentionPreview } from "../../services/notificationOpsTypes";

export function RetentionControls({
  preview,
  onPurge,
  purging,
}: {
  preview?: RetentionPreview;
  onPurge: (policy: {
    deletedNotificationDays: number;
    terminalOutboxDays: number;
  }) => void;
  purging?: boolean;
}) {
  const [deletedDays, setDeletedDays] = useState(
    preview?.policy.deletedNotificationDays ?? 90,
  );
  const [outboxDays, setOutboxDays] = useState(preview?.policy.terminalOutboxDays ?? 90);

  if (!preview) {
    return <FormHint>Loading retention preview…</FormHint>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention</CardTitle>
        <CardDescription>
          Eligible now: {preview.notificationsEligible} soft-deleted notifications,{" "}
          {preview.outboxEligible} terminal outbox rows (policy{" "}
          {preview.policy.deletedNotificationDays}/{preview.policy.terminalOutboxDays} days).
        </CardDescription>
      </CardHeader>
      <div className="space-y-4 px-6 pb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--tc-muted)]">Deleted notification days</span>
            <Input
              type="number"
              min={1}
              max={3650}
              value={deletedDays}
              onChange={(e) => setDeletedDays(Number(e.target.value) || 90)}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--tc-muted)]">Terminal outbox days</span>
            <Input
              type="number"
              min={1}
              max={3650}
              value={outboxDays}
              onChange={(e) => setOutboxDays(Number(e.target.value) || 90)}
              className="mt-1"
            />
          </label>
        </div>
        <Button
          variant="secondary"
          disabled={purging}
          onClick={() =>
            onPurge({
              deletedNotificationDays: deletedDays,
              terminalOutboxDays: outboxDays,
            })
          }
        >
          {purging ? "Purging…" : "Purge expired records"}
        </Button>
      </div>
    </Card>
  );
}
