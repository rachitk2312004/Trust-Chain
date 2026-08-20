import { useState } from "react";
import { Button, FormHint, Input, Label, Modal } from "@trustchain/ui";

export function EvidenceLinkDialog({
  open,
  onClose,
  onLink,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onLink: (input: { targetType: string; targetId: string; label?: string }) => void;
  pending?: boolean;
}) {
  const [targetType, setTargetType] = useState("assessment");
  const [targetId, setTargetId] = useState("");
  const [label, setLabel] = useState("");

  return (
    <Modal open={open} title="Link evidence" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onLink({
            targetType,
            targetId,
            label: label || undefined,
          });
        }}
      >
        <FormHint>
          Link this evidence to an assessment, violation, remediation, report, document, audit
          event, or control.
        </FormHint>
        <div>
          <Label htmlFor="link-type">Target type</Label>
          <select
            id="link-type"
            className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
          >
            <option value="assessment">assessment</option>
            <option value="violation">violation</option>
            <option value="remediation">remediation</option>
            <option value="report">report</option>
            <option value="document">document</option>
            <option value="audit_event">audit_event</option>
            <option value="control">control</option>
          </select>
        </div>
        <div>
          <Label htmlFor="link-id">Target id</Label>
          <Input
            id="link-id"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="link-label">Label</Label>
          <Input id="link-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !targetId}>
            {pending ? "Linking…" : "Create link"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
