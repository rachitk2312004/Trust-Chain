import { useState } from "react";
import { Button, FormError, FormHint, Input, Modal, Textarea } from "@trustchain/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import { useCreateDeveloperWebhook } from "./hooks";

export function WebhookDialog({
  open,
  onClose,
  organizationId,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
}) {
  const feedback = useFeedback();
  const create = useCreateDeveloperWebhook();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [eventsText, setEventsText] = useState(
    "document.created, document.updated, certificate.created, certificate.revoked, signature.created, signature.revoked, tenant.updated",
  );
  const [secret, setSecret] = useState<string | null>(null);

  const submit = () => {
    const events = eventsText
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    create.mutate(
      {
        organizationId,
        name: name.trim(),
        url: url.trim(),
        events,
      },
      {
        onSuccess: (data) => {
          feedback.success("Webhook registered");
          setSecret(data.secret);
          setName("");
          setUrl("");
        },
        onError: (err) => feedback.error(err, "Create failed"),
      },
    );
  };

  const close = () => {
    setSecret(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Register webhook">
      {secret ? (
        <div className="space-y-3">
          <FormHint>Copy the signing secret now. It will not be shown again.</FormHint>
          <pre className="overflow-auto rounded border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 text-xs">
            {secret}
          </pre>
          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Endpoint URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hooks/trustchain"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Events (comma-separated)</label>
            <Textarea
              value={eventsText}
              onChange={(e) => setEventsText(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={create.isPending}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || !url.trim() || create.isPending}
              onClick={submit}
            >
              {create.isPending ? "Creating…" : "Register"}
            </Button>
          </div>
          <FormError>{create.error ? getApiErrorMessage(create.error) : null}</FormError>
        </div>
      )}
    </Modal>
  );
}
