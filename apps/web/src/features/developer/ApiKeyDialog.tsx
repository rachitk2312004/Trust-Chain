import { useState } from "react";
import { Button, FormError, FormHint, Input, Modal } from "@trustchain/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import { useCreateDeveloperApiKey } from "./hooks";
import { ScopeEditor } from "./ScopeEditor";

export function ApiKeyDialog({
  open,
  onClose,
  organizationId,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
}) {
  const feedback = useFeedback();
  const create = useCreateDeveloperApiKey();
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [secret, setSecret] = useState<string | null>(null);

  const submit = () => {
    create.mutate(
      {
        organizationId,
        name: name.trim(),
        scopes,
        environment,
      },
      {
        onSuccess: (data) => {
          feedback.success("API key created");
          setSecret(data.secret);
          setName("");
        },
        onError: (err) => feedback.error(err, "Create failed"),
      },
    );
  };

  const close = () => {
    setSecret(null);
    setName("");
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Create API key">
      {secret ? (
        <div className="space-y-3">
          <FormHint>Copy this secret now. It will not be shown again.</FormHint>
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
            <label className="mb-1 block text-sm font-medium">Environment</label>
            <select
              className="h-10 w-full rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 text-sm"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as "live" | "test")}
            >
              <option value="live">live</option>
              <option value="test">test</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Scopes</label>
            <ScopeEditor scopes={scopes} onChange={setScopes} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={create.isPending}>
              Cancel
            </Button>
            <Button disabled={!name.trim() || create.isPending} onClick={submit}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
          <FormError>{create.error ? getApiErrorMessage(create.error) : null}</FormError>
        </div>
      )}
    </Modal>
  );
}
