import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Field, FormError, FormHint, Label, Modal, Select } from "@trustchain/ui";
import { getCertificateErrorMessage } from "../../lib/certificateErrors";
import type { CertificateBulkFormat } from "../../types/api";
import { useCertificateTemplates, useStartCertificateBulk } from "./hooks";

export function BulkCertificateDialog({
  organizationId,
  open,
  onClose,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const templates = useCertificateTemplates(organizationId);
  const start = useStartCertificateBulk(organizationId);
  const [format, setFormat] = useState<CertificateBulkFormat>("csv");
  const [templateId, setTemplateId] = useState("");
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function reset() {
    setFormat("csv");
    setTemplateId("");
    setFileName("");
    setContent("");
    setDragOver(false);
    start.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function readFile(file: File) {
    const text = await file.text();
    setFileName(file.name);
    setContent(text);
    if (file.name.toLowerCase().endsWith(".json")) setFormat("json");
    else if (file.name.toLowerCase().endsWith(".csv")) setFormat("csv");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    start.mutate(
      {
        format,
        content,
        defaultTemplateId: templateId || null,
        rollbackOnCancel: true,
        requireAllValid: true,
      },
      {
        onSuccess: (data) => {
          handleClose();
          navigate(`/certificates/bulk?jobId=${encodeURIComponent(data.job.jobId)}`);
        },
      },
    );
  }

  const activeTemplates = (templates.data ?? []).filter((t) => t.status === "active");

  return (
    <Modal
      open={open}
      title="Bulk issue certificates"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="bulk-cert-dialog-form" disabled={start.isPending || !content}>
            {start.isPending ? "Starting…" : "Start bulk job"}
          </Button>
        </>
      }
    >
      <form id="bulk-cert-dialog-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        <FormHint>
          Upload CSV or JSON with recipient_name, recipient_email, certificate_identifier,
          issue_date, expiration_date, template_identifier, metadata.
        </FormHint>
        <div
          className={`rounded border border-dashed p-6 text-center text-sm ${
            dragOver ? "border-[var(--tc-accent)] bg-[var(--tc-surface-2)]" : "border-[var(--tc-border)]"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void readFile(file);
          }}
        >
          <p className="mb-2">Drag and drop a file here</p>
          <label className="cursor-pointer text-[var(--tc-accent)] hover:underline">
            Choose file
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </label>
          {fileName ? <p className="mt-2 text-xs text-[var(--tc-muted)]">{fileName}</p> : null}
        </div>
        <Field>
          <Label htmlFor="bulk-dialog-format">Format</Label>
          <Select
            id="bulk-dialog-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as CertificateBulkFormat)}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="bulk-dialog-template">Default template</Label>
          <Select
            id="bulk-dialog-template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">None</option>
            {activeTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} ({tpl.code})
              </option>
            ))}
          </Select>
        </Field>
        <FormError>{start.error ? getCertificateErrorMessage(start.error) : null}</FormError>
      </form>
    </Modal>
  );
}
