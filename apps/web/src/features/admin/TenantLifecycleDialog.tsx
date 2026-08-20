import { useState } from "react";
import { Button, FormError, FormHint, Modal, Textarea } from "@trustchain/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import {
  useArchiveAdminTenant,
  useRestoreAdminTenant,
  useSuspendAdminTenant,
} from "./hooks";

type LifecycleAction = "suspend" | "restore" | "archive";

export function TenantLifecycleDialog({
  open,
  onClose,
  tenantId,
  tenantName,
  currentStatus,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  currentStatus: string;
}) {
  const feedback = useFeedback();
  const suspend = useSuspendAdminTenant();
  const restore = useRestoreAdminTenant();
  const archive = useArchiveAdminTenant();
  const [action, setAction] = useState<LifecycleAction>("suspend");
  const [reason, setReason] = useState("");

  const pending = suspend.isPending || restore.isPending || archive.isPending;
  const error = suspend.error || restore.error || archive.error;

  const run = () => {
    const opts = {
      onSuccess: () => {
        feedback.success(`Tenant ${action}d`);
        setReason("");
        onClose();
      },
      onError: (err: unknown) => feedback.error(err, `Failed to ${action} tenant`),
    };
    if (action === "suspend") suspend.mutate({ tenantId, reason: reason || undefined }, opts);
    else if (action === "restore") restore.mutate({ tenantId, reason: reason || undefined }, opts);
    else archive.mutate({ tenantId, reason: reason || undefined }, opts);
  };

  return (
    <Modal open={open} onClose={onClose} title="Tenant lifecycle">
      <FormHint>
        Manage lifecycle for <strong>{tenantName}</strong> (currently {currentStatus}).
      </FormHint>
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Action</label>
          <select
            className="h-10 w-full rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 text-sm"
            value={action}
            onChange={(e) => setAction(e.target.value as LifecycleAction)}
          >
            <option value="suspend">Suspend</option>
            <option value="restore">Restore</option>
            <option value="archive">Archive</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Reason (optional)</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why is this change being made?"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={action === "archive" ? "danger" : "secondary"}
            disabled={pending}
            onClick={run}
          >
            {pending ? "Working…" : `Confirm ${action}`}
          </Button>
        </div>
        <FormError>{error ? getApiErrorMessage(error) : null}</FormError>
      </div>
    </Modal>
  );
}
