import { useCallback, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button, Field, FormError, FormHint, Input, Label, Modal } from "@trustchain/ui";
import { useUploadDocument } from "./hooks";
import { getDocumentErrorMessage, validateLocalFile } from "../../lib/docErrors";

export function DocumentUploadDialog({
  organizationId,
  open,
  onClose,
  onUploaded,
  documentId,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
  onUploaded?: (documentId: string) => void;
  documentId?: string;
}) {
  const upload = useUploadDocument(organizationId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const setPickedFile = useCallback((next: File | null) => {
    setLocalError(null);
    if (!next) {
      setFile(null);
      return;
    }
    const err = validateLocalFile(next);
    if (err) {
      setLocalError(err);
      setFile(null);
      return;
    }
    setFile(next);
    setTitle((prev) => prev || next.name);
  }, []);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const next = event.dataTransfer.files?.[0] ?? null;
    setPickedFile(next);
  }

  function reset() {
    setTitle("");
    setFile(null);
    setLocalError(null);
    upload.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setLocalError("Choose a file to upload.");
      return;
    }
    upload.mutate(
      {
        file,
        title: title.trim() || file.name,
        documentId,
        activate: true,
      },
      {
        onSuccess: (result) => {
          const id = result.document.id;
          handleClose();
          onUploaded?.(id);
        },
      },
    );
  }

  const errorMessage =
    localError ?? (upload.error ? getDocumentErrorMessage(upload.error) : null);

  return (
    <Modal
      open={open}
      title={documentId ? "Upload new version" : "Upload document"}
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="doc-upload-form" disabled={upload.isPending}>
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </>
      }
    >
      <form id="doc-upload-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        {!documentId ? (
          <Field>
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
            />
          </Field>
        ) : null}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={[
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm",
            dragOver
              ? "border-[var(--tc-accent)] bg-[var(--tc-surface-2)]"
              : "border-[var(--tc-border)] bg-[var(--tc-surface)]",
          ].join(" ")}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <p className="font-medium text-[var(--tc-fg)]">
            {file ? file.name : "Drag and drop a file here"}
          </p>
          <p className="text-[var(--tc-muted)]">
            PDF, PNG, JPEG, WebP, DOC, DOCX · max 25 MiB
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {file ? (
          <FormHint>
            {(file.size / 1024).toFixed(1)} KiB · {file.type || "unknown type"}
          </FormHint>
        ) : null}

        <FormError>{errorMessage}</FormError>
        {upload.isPending ? (
          <FormHint>Creating session, uploading to storage, hashing, then confirming…</FormHint>
        ) : null}
      </form>
    </Modal>
  );
}
