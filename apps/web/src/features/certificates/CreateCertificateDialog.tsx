import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CERTIFICATE_LAYOUT_PRESETS } from "@trustchain/config";
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
import { defaultCertificateLayoutPreview, getCertificateErrorMessage } from "../../lib/certificateErrors";
import { useFeedback } from "../../hooks/useFeedback";
import type { CertificateRecipientMatch } from "../../types/api";
import { useCertificateTemplates, useCreateCertificate, useLookupCertificateRecipients } from "./hooks";
import { TemplateLayoutPreview } from "./TemplateLayoutPreview";

type LayoutChoice =
  | { kind: "default" }
  | { kind: "preset"; id: string }
  | { kind: "template"; id: string };

function parseLayoutChoice(value: string): LayoutChoice {
  if (!value) return { kind: "default" };
  if (value.startsWith("preset:")) return { kind: "preset", id: value.slice("preset:".length) };
  if (value.startsWith("template:")) return { kind: "template", id: value.slice("template:".length) };
  // Backward-compatible: raw template uuid
  return { kind: "template", id: value };
}

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
  const feedback = useFeedback();
  const templates = useCertificateTemplates(organizationId);
  const [title, setTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailQuery, setEmailQuery] = useState("");
  const [showMatches, setShowMatches] = useState(false);
  const [description, setDescription] = useState("");
  const [layoutChoice, setLayoutChoice] = useState("preset:classic-gold");
  const [documentId, setDocumentId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [createQr, setCreateQr] = useState(true);
  const [publishToChain, setPublishToChain] = useState(true);

  const recipientLookup = useLookupCertificateRecipients(organizationId, emailQuery);

  useEffect(() => {
    if (!open) return;
    create.reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setTimeout(() => setEmailQuery(recipientEmail.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [recipientEmail]);

  function reset() {
    setTitle("");
    setRecipientName("");
    setRecipientEmail("");
    setEmailQuery("");
    setShowMatches(false);
    setDescription("");
    setLayoutChoice("preset:classic-gold");
    setDocumentId("");
    setExpiresAt("");
    setCreateQr(true);
    setPublishToChain(true);
    create.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const choice = parseLayoutChoice(layoutChoice);
    create.mutate(
      {
        title: title.trim(),
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim() || null,
        description: description.trim() || null,
        templateId: choice.kind === "template" ? choice.id : null,
        preset: choice.kind === "preset" ? choice.id : null,
        documentId: documentId || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        createQr,
        publishToChain,
      },
      {
        onSuccess: (result) => {
          handleClose();
          onCreated?.(result.certificate.id);
          if (publishToChain && result.chain?.reason === "PUBLISH_IN_PROGRESS") {
            feedback.success(
              "Certificate issued",
              "QR and blockchain publish will finish in the background.",
            );
          } else if (publishToChain && result.chain?.skipped && result.chain.reason) {
            feedback.warning(
              "Certificate issued",
              `On-chain publish skipped: ${result.chain.reason}`,
            );
          } else if (result.chain?.status === "anchored") {
            feedback.success("Certificate issued and anchored on-chain");
          } else {
            feedback.success("Certificate issued");
          }
        },
      },
    );
  }

  const activeTemplates = (templates.data ?? []).filter((t) => t.status === "active");
  const previewLayout = useMemo(() => {
    const choice = parseLayoutChoice(layoutChoice);
    if (choice.kind === "preset") {
      const preset = CERTIFICATE_LAYOUT_PRESETS.find((p) => p.id === choice.id);
      return preset ? ({ ...preset.layout } as Record<string, unknown>) : defaultCertificateLayoutPreview();
    }
    if (choice.kind === "template") {
      const tpl = (templates.data ?? []).find((t) => t.id === choice.id);
      if (tpl?.layout && typeof tpl.layout === "object") {
        return { ...(tpl.layout as Record<string, unknown>) };
      }
    }
    return defaultCertificateLayoutPreview();
  }, [layoutChoice, templates.data]);
  const exact = recipientLookup.data?.exact ?? null;
  const matches = recipientLookup.data?.matches ?? [];

  function applyRecipient(match: CertificateRecipientMatch) {
    setRecipientEmail(match.email);
    setEmailQuery(match.email);
    if (!recipientName.trim()) setRecipientName(match.displayName);
    setShowMatches(false);
  }

  return (
    <Modal
      open={open}
      title="Issue certificate"
      onClose={handleClose}
      className="max-w-4xl"
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
      <form id="create-certificate-form" className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
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
          <Label htmlFor="cert-template">Template</Label>
          <Select
            id="cert-template"
            value={layoutChoice}
            onChange={(e) => setLayoutChoice(e.target.value)}
          >
            <option value="">Plain default layout</option>
            <optgroup label="Built-in designs">
              {CERTIFICATE_LAYOUT_PRESETS.map((preset) => (
                <option key={preset.id} value={`preset:${preset.id}`}>
                  {preset.name} · {preset.layout.orientation}
                </option>
              ))}
            </optgroup>
            {activeTemplates.length > 0 ? (
              <optgroup label="Organization templates">
                {activeTemplates.map((tpl) => (
                  <option key={tpl.id} value={`template:${tpl.id}`}>
                    {tpl.name} ({tpl.code})
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
          {templates.isLoading ? <FormHint>Loading organization templates…</FormHint> : null}
          {templates.isError ? (
            <FormHint>
              Could not load organization templates. Built-in designs are still available.
            </FormHint>
          ) : null}
          {!templates.isLoading && !templates.isError && activeTemplates.length === 0 ? (
            <FormHint>
              No saved org templates yet. Built-in designs work immediately, or{" "}
              <Link to="/certificates/templates" className="text-[var(--tc-accent)] hover:underline">
                add templates
              </Link>
              .
            </FormHint>
          ) : null}
        </Field>
        <Field>
          <Label htmlFor="cert-recipient">Recipient name</Label>
          <Input
            id="cert-recipient"
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Full name as it should appear"
          />
        </Field>
        <Field>
          <Label htmlFor="cert-email">Recipient email (optional)</Label>
          <Input
            id="cert-email"
            type="search"
            autoComplete="off"
            value={recipientEmail}
            onChange={(e) => {
              setRecipientEmail(e.target.value);
              setShowMatches(true);
            }}
            onFocus={() => setShowMatches(true)}
            placeholder="Search name or email…"
          />
          {showMatches && emailQuery.length >= 2 && matches.length > 0 ? (
            <ul
              className="max-h-36 overflow-auto rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface-2)] py-1"
              role="listbox"
            >
              {matches.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer flex-col px-3 py-1.5 text-left hover:bg-[var(--tc-surface)]"
                    onClick={() => applyRecipient(match)}
                  >
                    <span className="font-medium text-[var(--tc-fg)]">{match.displayName}</span>
                    <span className="text-xs text-[var(--tc-muted)]">{match.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {recipientLookup.isFetching && emailQuery.length >= 2 ? (
            <FormHint>Checking account…</FormHint>
          ) : exact?.exists && exact.user ? (
            <FormHint>
              Account found: {exact.user.displayName}
              {exact.inOrganization ? " · already in this organization" : " · available in My certificates"}
            </FormHint>
          ) : exact && !exact.exists ? (
            <FormHint>No account yet — they will see it after signing up with this email.</FormHint>
          ) : (
            <FormHint>Search an account, or type any email to claim later.</FormHint>
          )}
        </Field>
        <Field className="sm:col-span-2">
          <Label htmlFor="cert-description">Description (optional)</Label>
          <Textarea
            id="cert-description"
            className="min-h-16"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Shown on the certificate PDF"
          />
        </Field>
        <Field>
          <Label htmlFor="cert-expires">Expiration (optional)</Label>
          <Input
            id="cert-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </Field>
        <details className="rounded-md border border-[var(--tc-border)] px-3 py-2 sm:col-span-1">
          <summary className="cursor-pointer text-sm font-medium text-[var(--tc-fg)]">
            Link a document{documentId ? " · selected" : " (optional)"}
          </summary>
          <div className="mt-2">
            <DocumentPicker
              organizationId={organizationId}
              value={documentId}
              onChange={setDocumentId}
              label="Source document"
            />
          </div>
        </details>
        <div className="flex flex-col gap-2 rounded-md border border-[var(--tc-border)] px-3 py-2.5 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createQr}
              onChange={(e) => setCreateQr(e.target.checked)}
            />
            Embed verification QR
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publishToChain}
              onChange={(e) => setPublishToChain(e.target.checked)}
            />
            Publish to blockchain
          </label>
          <FormHint>
            QR is printed on the PDF. Publishing anchors the content hash on-chain.
          </FormHint>
        </div>
        {create.error ? (
          <div className="sm:col-span-2">
            <FormError>{getCertificateErrorMessage(create.error)}</FormError>
          </div>
        ) : null}
      </form>
      <TemplateLayoutPreview
        organizationId={organizationId}
        layout={previewLayout}
        enabled={open}
        title="Template preview"
      />
      </div>
    </Modal>
  );
}
