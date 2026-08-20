import { useState } from "react";
import { Button, FormError, FormHint, Label, Modal } from "@trustchain/ui";

export function AuditExportDialog({
  open,
  onClose,
  onExport,
  pending,
  error,
  lastContent,
}: {
  open: boolean;
  onClose: () => void;
  onExport: (format: "json" | "csv") => void;
  pending?: boolean;
  error?: string | null;
  lastContent?: string | null;
}) {
  const [format, setFormat] = useState<"json" | "csv">("json");

  return (
    <Modal open={open} title="Export audit events" onClose={onClose}>
      <div className="space-y-4">
        <FormHint>Exports use the currently applied explorer filters.</FormHint>
        <div>
          <Label htmlFor="export-format">Format</Label>
          <select
            id="export-format"
            className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
            value={format}
            onChange={(e) => setFormat(e.target.value as "json" | "csv")}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>
        {error ? <FormError>{error}</FormError> : null}
        <div className="flex gap-2">
          <Button type="button" disabled={pending} onClick={() => onExport(format)}>
            {pending ? "Exporting…" : "Export"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        {lastContent ? (
          <pre className="max-h-64 overflow-auto rounded border border-[var(--tc-border)] p-3 text-xs">
            {lastContent.slice(0, 4000)}
            {lastContent.length > 4000 ? "\n…" : ""}
          </pre>
        ) : null}
      </div>
    </Modal>
  );
}
