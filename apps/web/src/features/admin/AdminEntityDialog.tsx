import { useEffect, useState } from "react";
import { Badge, Button, FormError, FormHint, Input, Modal, Textarea } from "@trustchain/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { adminStatusRemark, adminStatusLabel, adminStatusTone } from "./adminStatus";

export type AdminLifecycleTarget =
  | {
      kind: "user";
      id: string;
      label: string;
      status: string;
      isSuperAdmin?: boolean;
    }
  | {
      kind: "organization" | "tenant";
      id: string;
      label: string;
      status: string;
    };

type LifecycleAction = "suspend" | "restore" | "delete" | "archive";

export function AdminLifecycleDialog({
  open,
  onClose,
  target,
  onSuspend,
  onRestore,
  onDelete,
  onArchive,
  pending = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  target: AdminLifecycleTarget | null;
  onSuspend: (input: { id: string; reason?: string }) => void;
  onRestore: (input: { id: string; reason?: string }) => void;
  onDelete?: (input: { id: string; reason?: string }) => void;
  onArchive?: (input: { id: string; reason?: string }) => void;
  pending?: boolean;
  error?: unknown;
}) {
  const [action, setAction] = useState<LifecycleAction>("suspend");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open || !target) return;
    if (target.status === "active" || target.status === "pending") setAction("suspend");
    else if (target.status === "suspended" || target.status === "disabled") setAction("restore");
    else if (target.status === "deleted") setAction("restore");
    else setAction("suspend");
    setReason("");
  }, [open, target]);

  if (!target) return null;

  const remark =
    target.kind === "tenant"
      ? null
      : adminStatusRemark(target.kind, target.status === "disabled" ? "disabled" : target.status);

  const run = () => {
    const payload = { id: target.id, reason: reason.trim() || undefined };
    if (action === "suspend") onSuspend(payload);
    else if (action === "restore") onRestore(payload);
    else if (action === "delete" && onDelete) onDelete(payload);
    else if (action === "archive" && onArchive) onArchive(payload);
  };

  const blocked = target.kind === "user" && target.isSuperAdmin;

  return (
    <Modal open={open} onClose={onClose} title="Account & lifecycle">
      <FormHint>
        Manage <strong>{target.label}</strong> (currently {target.status}).
      </FormHint>
      {remark ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{remark}</p>
      ) : null}
      {blocked ? (
        <p className="mt-3 text-sm text-rose-600">
          Super admin accounts cannot be suspended or modified from this panel.
        </p>
      ) : (
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
              {target.kind !== "user" && onDelete ? <option value="delete">Delete</option> : null}
              {target.kind === "tenant" && onArchive ? (
                <option value="archive">Archive</option>
              ) : null}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Remark (shown in audit & confirmation)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={
                action === "suspend"
                  ? "Why is this being suspended?"
                  : "Optional note for the audit log"
              }
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant={action === "delete" || action === "archive" ? "danger" : "secondary"}
              disabled={pending}
              onClick={run}
            >
              {pending ? "Working…" : `Confirm ${action}`}
            </Button>
          </div>
          <FormError>{error ? getApiErrorMessage(error) : null}</FormError>
        </div>
      )}
    </Modal>
  );
}

export function AdminEditDialog({
  open,
  onClose,
  title,
  fields,
  onSave,
  pending = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: Array<{ key: string; label: string; value: string; placeholder?: string; mono?: boolean }>;
  onSave: (values: Record<string, string>) => void;
  pending?: boolean;
  error?: unknown;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(fields.map((field) => [field.key, field.value])));
  }, [open, fields]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-sm font-medium">{field.label}</label>
            <Input
              className={field.mono ? "font-mono text-xs" : undefined}
              value={values[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => onSave(values)}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
        <FormError>{error ? getApiErrorMessage(error) : null}</FormError>
      </div>
    </Modal>
  );
}

export function AdminStatusCell({
  entity,
  status,
}: {
  entity: "user" | "organization" | "tenant";
  status: string;
}) {
  const remark =
    entity === "tenant" ? null : adminStatusRemark(entity, status === "disabled" ? "disabled" : status);
  const tone = adminStatusTone(status);
  return (
    <div className="space-y-1">
      <Badge tone={tone === "danger" ? "neutral" : tone}>{adminStatusLabel(status)}</Badge>
      {remark ? <p className="max-w-xs text-[11px] leading-snug text-[var(--tc-muted)]">{remark}</p> : null}
    </div>
  );
}
