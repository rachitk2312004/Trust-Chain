import { Button, FormHint, Modal } from "@trustchain/ui";
import type { DeveloperWebhookDelivery } from "../../types/api";
import { useFeedback } from "../../hooks/useFeedback";
import { useReplayWebhookDelivery } from "./hooks";

export function WebhookReplayDialog({
  open,
  onClose,
  webhookId,
  organizationId,
  delivery,
}: {
  open: boolean;
  onClose: () => void;
  webhookId: string;
  organizationId: string;
  delivery: DeveloperWebhookDelivery | null;
}) {
  const feedback = useFeedback();
  const replay = useReplayWebhookDelivery();

  if (!delivery) return null;

  const submit = () => {
    replay.mutate(
      { webhookId, organizationId, deliveryId: delivery.id },
      {
        onSuccess: () => {
          feedback.success("Delivery replayed");
          onClose();
        },
        onError: (err) => feedback.error(err, "Replay failed"),
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Replay delivery">
      <div className="space-y-3">
        <FormHint>
          Creates a new delivery from event <strong>{delivery.eventType}</strong> and dispatches it
          immediately with a fresh HMAC signature and timestamp.
        </FormHint>
        <div className="rounded border border-[var(--tc-border)] p-3 text-sm">
          <div>
            Source: <span className="font-mono text-xs">{delivery.id}</span>
          </div>
          <div>Status: {delivery.status}</div>
          <div>Attempts: {delivery.attemptCount}</div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={replay.isPending}>
            {replay.isPending ? "Replaying…" : "Replay"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
