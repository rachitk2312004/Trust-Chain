import { useState } from "react";
import { Button, FormHint, Input, Modal, Textarea } from "@trustchain/ui";
import { useFeedback } from "../../hooks/useFeedback";
import { useTestWebhook } from "./hooks";

export function WebhookTestDialog({
  open,
  onClose,
  webhookId,
  organizationId,
}: {
  open: boolean;
  onClose: () => void;
  webhookId: string;
  organizationId: string;
}) {
  const feedback = useFeedback();
  const test = useTestWebhook();
  const [eventType, setEventType] = useState("webhook.test");
  const [dataText, setDataText] = useState('{"message":"TrustChain webhook test"}');

  const submit = () => {
    let data: Record<string, unknown> | undefined;
    try {
      data = JSON.parse(dataText) as Record<string, unknown>;
    } catch {
      feedback.error(new Error("Invalid JSON"), "Invalid payload JSON");
      return;
    }
    test.mutate(
      { webhookId, organizationId, eventType: eventType.trim() || undefined, data },
      {
        onSuccess: (result) => {
          const ok = result.dispatch?.ok;
          feedback.success(ok ? "Test delivered successfully" : "Test queued / attempted");
          onClose();
        },
        onError: (err) => feedback.error(err, "Test failed"),
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Send test event">
      <div className="space-y-3">
        <FormHint>
          Creates a pending delivery and dispatches it immediately with HMAC signing.
        </FormHint>
        <div>
          <label className="mb-1 block text-sm font-medium">Event type</label>
          <Input value={eventType} onChange={(e) => setEventType(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Payload data (JSON)</label>
          <Textarea value={dataText} onChange={(e) => setDataText(e.target.value)} rows={5} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={test.isPending}>
            {test.isPending ? "Sending…" : "Send test"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
