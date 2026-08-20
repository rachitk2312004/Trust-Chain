import { useState } from "react";
import { Button, FormHint, Input, Modal, Textarea } from "@trustchain/ui";
import { useFeedback } from "../../hooks/useFeedback";
import { useCreateDeveloperServiceAccount } from "./hooks";

export function ServiceAccountDialog({
  open,
  onClose,
  organizationId,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
}) {
  const feedback = useFeedback();
  const create = useCreateDeveloperServiceAccount();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [secret, setSecret] = useState<string | null>(null);

  const submit = () => {
    create.mutate(
      {
        organizationId,
        name: name.trim(),
        description: description.trim() || null,
      },
      {
        onSuccess: (data) => {
          feedback.success("Service account created");
          setSecret(data.secret);
          setName("");
          setDescription("");
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
    <Modal open={open} onClose={close} title="Create service account">
      {secret ? (
        <div className="space-y-3">
          <FormHint>Copy the service account secret now. It will not be shown again.</FormHint>
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
            <label className="mb-1 block text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button disabled={!name.trim() || create.isPending} onClick={submit}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
