import { useState } from "react";
import { Button, FormHint, Label, Modal } from "@trustchain/ui";

export function RetentionRunDialog({
  open,
  onClose,
  onRun,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onRun: (input: { dryRun: boolean; targetType?: string }) => void;
  pending?: boolean;
}) {
  const [dryRun, setDryRun] = useState(true);
  const [targetType, setTargetType] = useState("");

  return (
    <Modal open={open} title="Run retention" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onRun({
            dryRun,
            targetType: targetType || undefined,
          });
        }}
      >
        <FormHint>
          Evaluates active policies, enforces legal holds, archives expired records, and optionally
          purges. Audit events are never hard-deleted.
        </FormHint>
        <div>
          <Label htmlFor="ret-target">Target type (optional)</Label>
          <select
            id="ret-target"
            className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
          >
            <option value="">All policy targets</option>
            <option value="document">document</option>
            <option value="certificate">certificate</option>
            <option value="signature">signature</option>
            <option value="audit_event">audit_event</option>
            <option value="evidence">evidence</option>
            <option value="report">report</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Dry run (preview only)
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Running…" : dryRun ? "Preview" : "Run"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
