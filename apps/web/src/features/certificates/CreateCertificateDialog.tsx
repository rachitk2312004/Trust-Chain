import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
} from "@trustchain/ui";
import { DocumentPicker } from "../../components/DocumentPicker";
import { getCertificateErrorMessage } from "../../lib/certificateErrors";
import { useCertificateTemplates, useCreateCertificate } from "./hooks";

export function CreateCertificateDialog({
  organizationId,
  open,
  onClose,
  onCreated,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (certificateId: string) => void;
}) {
  const create = useCreateCertificate(organizationId);
  const templates = useCertificateTemplates(organizationId);
  const [title, setTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [createQr, setCreateQr] = useState(false);

  useEffect(() => {
    if (!open) return;
    create.reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    setTitle("");
    setRecipientName("");
    setRecipientEmail("");
    setDescription("");
    setTemplateId("");
    setDocumentId("");
    setExpiresAt("");
    setCreateQr(false);
    create.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      {
        title: title.trim(),
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim() || null,
        description: description.trim() || null,
        templateId: templateId || null,
        documentId: documentId || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        createQr: createQr && Boolean(documentId),
      },
      {
        onSuccess: (certificate) => {
          handleClose();
          onCreated?.(certificate.id);
        },
      },
    );
  }

  const activeTemplates = (templates.data ?? []).filter((t) => t.status === "active");

  return (
    <Modal
      open={open}
      title="Issue certificate"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-certificate-form"
            disabled={create.isPending || !title.trim() || !recipientName.trim()}
          >
            {create.isPending ? "Issuing…" : "Issue"}
          </Button>
        </>
      }
    >
      <form id="create-certificate-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="cert-title">Title</Label>
          <Input
            id="cert-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Certificate of Completion"
          />
        </Field>
        <Field>
          <Label htmlFor="cert-recipient">Recipient name</Label>
          <Input
            id="cert-recipient"
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="cert-email">Recipient email (optional)</Label>
          <Input
            id="cert-email"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="cert-description">Description (optional)</Label>
          <Textarea
            id="cert-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>
        <Field>
          <Label htmlFor="cert-template">Template</Label>
          <Select
            id="cert-template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Default layout</option>
            {activeTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} ({tpl.code})
              </option>
            ))}
          </Select>
        </Field>
        <DocumentPicker
          organizationId={organizationId}
          value={documentId}
          onChange={setDocumentId}
          label="Linked document (optional)"
        />
        <Field>
          <Label htmlFor="cert-expires">Expiration (optional)</Label>
          <Input
            id="cert-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={createQr}
            disabled={!documentId}
            onChange={(e) => setCreateQr(e.target.checked)}
          />
          Register document QR code (optional)
        </label>
        <FormHint>
          A verification QR is embedded in the PDF automatically. Enable this only when linking a
          document QR record.
        </FormHint>
        {!documentId && createQr ? (
          <FormHint>Select a document to register a document QR code.</FormHint>
        ) : null}
        <FormError>{create.error ? getCertificateErrorMessage(create.error) : null}</FormError>
      </form>
    </Modal>
  );
}
