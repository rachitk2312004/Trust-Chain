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
import { useCertificates } from "../certificates/hooks";
import { getSignatureErrorMessage } from "../../lib/signatureErrors";
import { SUPPORTED_SIGNATURE_ALGORITHMS, useCreateSignature } from "./hooks";

type SignMode = "document" | "certificate" | "generic";

export function CreateSignatureDialog({
  organizationId,
  open,
  onClose,
  onCreated,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (signatureId: string, generatedPrivateKeyPem?: string | null) => void;
}) {
  const create = useCreateSignature(organizationId);
  const certificates = useCertificates(organizationId, { status: "issued", limit: 100 });
  const [mode, setMode] = useState<SignMode>("document");
  const [documentId, setDocumentId] = useState("");
  const [certificateId, setCertificateId] = useState("");
  const [algorithm, setAlgorithm] = useState<string>(SUPPORTED_SIGNATURE_ALGORITHMS[0] ?? "RSA-SHA256");
  const [expiresAt, setExpiresAt] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [contentHash, setContentHash] = useState("");

  useEffect(() => {
    if (!open) return;
    create.reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    setMode("document");
    setDocumentId("");
    setCertificateId("");
    setAlgorithm(SUPPORTED_SIGNATURE_ALGORITHMS[0] ?? "RSA-SHA256");
    setExpiresAt("");
    setPrivateKeyPem("");
    setContentHash("");
    create.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const shared = {
      algorithm,
      privateKeyPem: privateKeyPem.trim() || undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    };

    if (mode === "document") {
      create.mutate(
        { mode: "document", documentId, ...shared },
        {
          onSuccess: (result) => {
            handleClose();
            onCreated?.(result.signature.id, result.generatedPrivateKeyPem);
          },
        },
      );
      return;
    }

    if (mode === "certificate") {
      create.mutate(
        { mode: "certificate", certificateId, ...shared },
        {
          onSuccess: (result) => {
            handleClose();
            onCreated?.(result.signature.id, result.generatedPrivateKeyPem);
          },
        },
      );
      return;
    }

    create.mutate(
      {
        mode: "generic",
        documentId: documentId || null,
        certificateId: certificateId || null,
        contentHash: contentHash.trim() || null,
        ...shared,
      },
      {
        onSuccess: (result) => {
          handleClose();
          onCreated?.(result.signature.id, result.generatedPrivateKeyPem);
        },
      },
    );
  }

  const canSubmit =
    mode === "document"
      ? Boolean(documentId)
      : mode === "certificate"
        ? Boolean(certificateId)
        : true;

  return (
    <Modal
      open={open}
      title="Create signature"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-signature-form"
            disabled={create.isPending || !canSubmit}
          >
            {create.isPending ? "Signing…" : "Sign"}
          </Button>
        </>
      }
    >
      <form id="create-signature-form" className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="sig-mode">Workflow</Label>
          <Select
            id="sig-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as SignMode)}
          >
            <option value="document">Document signing</option>
            <option value="certificate">Certificate signing</option>
            <option value="generic">Generic signature</option>
          </Select>
        </Field>

        {mode === "document" || mode === "generic" ? (
          <DocumentPicker
            organizationId={organizationId}
            value={documentId}
            onChange={setDocumentId}
            required={mode === "document"}
            label={mode === "document" ? "Document" : "Linked document (optional)"}
          />
        ) : null}

        {mode === "certificate" || mode === "generic" ? (
          <Field>
            <Label htmlFor="sig-certificate">
              {mode === "certificate" ? "Certificate" : "Linked certificate (optional)"}
            </Label>
            <Select
              id="sig-certificate"
              required={mode === "certificate"}
              value={certificateId}
              onChange={(e) => setCertificateId(e.target.value)}
            >
              <option value="">Select a certificate</option>
              {(certificates.data?.certificates ?? []).map((cert) => (
                <option key={cert.id} value={cert.id}>
                  {cert.publicId} — {cert.title}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {mode === "generic" ? (
          <Field>
            <Label htmlFor="sig-content-hash">Content hash (optional)</Label>
            <Input
              id="sig-content-hash"
              value={contentHash}
              onChange={(e) => setContentHash(e.target.value)}
              placeholder="sha256 hex"
            />
          </Field>
        ) : null}

        <Field>
          <Label htmlFor="sig-algorithm">Algorithm</Label>
          <Select
            id="sig-algorithm"
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value)}
          >
            {SUPPORTED_SIGNATURE_ALGORITHMS.map((alg) => (
              <option key={alg} value={alg}>
                {alg}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor="sig-expires">Expiration (optional)</Label>
          <Input
            id="sig-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          <FormHint>Leave blank to apply the organization default expiration policy.</FormHint>
        </Field>

        <Field>
          <Label htmlFor="sig-private-key">Private key PEM (optional)</Label>
          <Textarea
            id="sig-private-key"
            rows={4}
            value={privateKeyPem}
            onChange={(e) => setPrivateKeyPem(e.target.value)}
            placeholder="Omit to generate a one-time keypair"
          />
        </Field>

        <FormError>{create.error ? getSignatureErrorMessage(create.error) : null}</FormError>
      </form>
    </Modal>
  );
}
