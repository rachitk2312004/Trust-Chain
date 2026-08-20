import { useState, type FormEvent } from "react";
import { Button, Field, FormError, Input, Label, Modal, Select } from "@trustchain/ui";
import { DocumentPicker } from "../../components/DocumentPicker";
import { TemplatePicker } from "../../components/TemplatePicker";
import { useCreateQr } from "./hooks";
import { getQrErrorMessage } from "../../lib/qrErrors";

export function CreateQrDialog({
  organizationId,
  open,
  onClose,
  onCreated,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (publicCode: string) => void;
}) {
  const create = useCreateQr(organizationId);
  const [documentId, setDocumentId] = useState("");
  const [templatePublicCode, setTemplatePublicCode] = useState("");
  const [formatVersion, setFormatVersion] = useState<"V1" | "V2" | "V3">("V1");
  const [visibility, setVisibility] = useState<"public" | "restricted">("restricted");
  const [label, setLabel] = useState("");

  function reset() {
    setDocumentId("");
    setTemplatePublicCode("");
    setFormatVersion("V1");
    setVisibility("restricted");
    setLabel("");
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
        documentId: documentId.trim(),
        templatePublicCode: templatePublicCode || undefined,
        formatVersion,
        visibility,
        label: label.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          const code = result.qr.publicCode;
          handleClose();
          onCreated?.(code);
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      title="Generate QR code"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-qr-form" disabled={create.isPending || !documentId}>
            {create.isPending ? "Generating…" : "Generate"}
          </Button>
        </>
      }
    >
      <form id="create-qr-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        <DocumentPicker
          organizationId={organizationId}
          value={documentId}
          onChange={setDocumentId}
          required
          label="Document"
        />
        <TemplatePicker
          organizationId={organizationId}
          value={templatePublicCode}
          onChange={setTemplatePublicCode}
        />
        <Field>
          <Label htmlFor="qr-format">Format version</Label>
          <Select
            id="qr-format"
            value={formatVersion}
            onChange={(e) => setFormatVersion(e.target.value as typeof formatVersion)}
          >
            <option value="V1">V1</option>
            <option value="V2">V2</option>
            <option value="V3">V3</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="qr-visibility">Visibility</Label>
          <Select
            id="qr-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          >
            <option value="restricted">Restricted</option>
            <option value="public">Public</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="qr-label">Label (optional)</Label>
          <Input
            id="qr-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Internal label"
          />
        </Field>
        <FormError>{create.error ? getQrErrorMessage(create.error) : null}</FormError>
      </form>
    </Modal>
  );
}
