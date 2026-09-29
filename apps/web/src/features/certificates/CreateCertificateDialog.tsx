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
import {
  defaultCertificateLayoutPreview,
  getCertificateErrorMessage,
} from "../../lib/certificateErrors";
import { useFeedback } from "../../hooks/useFeedback";
import type { CertificateRecipientMatch } from "../../types/api";
import {
  useCertificateTemplates,
  useCreateCertificate,
  useLookupCertificateRecipients,
} from "./hooks";
import { TemplateLayoutPreview } from "./TemplateLayoutPreview";

type LayoutChoice =
  | { kind: "default" }
  | { kind: "preset"; id: string }
  | { kind: "template"; id: string };

function parseLayoutChoice(value: string): LayoutChoice {
  if (!value) return { kind: "default" };
  if (value.startsWith("preset:")) return { kind: "preset", id: value.slice("preset:".length) };
  if (value.startsWith("template:")) return { kind: "template", id: value.slice("template:".length) };
  return { kind: "template", id: value };
}

function selectedDesignLabel(choice: LayoutChoice): string {
  if (choice.kind === "preset") {
    return CERTIFICATE_LAYOUT_PRESETS.find((p) => p.id === choice.id)?.name ?? "Built-in design";
  }
  if (choice.kind === "template") return "Organization template";
  return "Default layout";
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
  const choice = parseLayoutChoice(layoutChoice);
  const previewLayout = useMemo(() => {
    const next = parseLayoutChoice(layoutChoice);
    if (next.kind === "preset") {
      const preset = CERTIFICATE_LAYOUT_PRESETS.find((p) => p.id === next.id);
      return preset
        ? ({ ...preset.layout } as Record<string, unknown>)
        : defaultCertificateLayoutPreview();
    }
    if (next.kind === "template") {
      const tpl = (templates.data ?? []).find((t) => t.id === next.id);
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
      className="max-w-6xl"
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
            {create.isPending ? "Issuing…" : "Issue certificate"}
          </Button>
        </>
      }
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.9fr)]">
        <form id="create-certificate-form" className="flex min-w-0 flex-col gap-7" onSubmit={onSubmit}>
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--tc-fg)]">Certificate details</h3>
              <p className="mt-1 text-xs text-[var(--tc-muted)]">
                Title and recipient appear on the printed certificate.
              </p>
            </div>
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
            <div className="grid gap-4 md:grid-cols-2">
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
                <Label htmlFor="cert-email">Recipient email</Label>
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
                    className="mt-1 max-h-36 overflow-auto rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface-2)] py-1"
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
                    {exact.inOrganization
                      ? " · already in this organization"
                      : " · available in My certificates"}
                  </FormHint>
                ) : exact && !exact.exists ? (
                  <FormHint>No account yet — they can claim it after signing up.</FormHint>
                ) : (
                  <FormHint>Optional. Lets them find this certificate later.</FormHint>
                )}
              </Field>
            </div>
            <Field>
              <Label htmlFor="cert-description">Description</Label>
              <Textarea
                id="cert-description"
                className="min-h-[4.5rem]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional note shown on the certificate PDF"
              />
            </Field>
          </section>

          <section className="space-y-4 border-t border-[var(--tc-border)] pt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--tc-fg)]">Design template</h3>
                <p className="mt-1 text-xs text-[var(--tc-muted)]">
                  Pick a built-in design. Preview updates on the right.
                </p>
              </div>
              <Link
                to="/certificates/templates"
                className="text-xs font-medium text-[var(--tc-accent)] hover:underline"
              >
                Manage templates
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CERTIFICATE_LAYOUT_PRESETS.map((preset) => {
                const selected = layoutChoice === `preset:${preset.id}`;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setLayoutChoice(`preset:${preset.id}`)}
                    className={`rounded-xl border px-3.5 py-3 text-left transition ${
                      selected
                        ? "border-[var(--tc-accent)] bg-[var(--tc-accent)]/10 shadow-sm"
                        : "border-[var(--tc-border)] bg-[var(--tc-surface)] hover:border-[var(--tc-accent)]/50"
                    }`}
                  >
                    <span
                      className="mb-2.5 block h-1.5 w-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${preset.layout.accentColor}, ${preset.layout.borderColor})`,
                      }}
                    />
                    <span className="block text-sm font-medium text-[var(--tc-fg)]">{preset.name}</span>
                    <span className="mt-1 block text-[11px] capitalize text-[var(--tc-muted)]">
                      {preset.layout.orientation} · {preset.layout.pageSize}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeTemplates.length > 0 ? (
              <Field>
                <Label htmlFor="cert-org-template">Or use a saved organization template</Label>
                <Select
                  id="cert-org-template"
                  value={choice.kind === "template" ? layoutChoice : ""}
                  onChange={(e) => {
                    if (e.target.value) setLayoutChoice(e.target.value);
                  }}
                >
                  <option value="">Use built-in design above</option>
                  {activeTemplates.map((tpl) => (
                    <option key={tpl.id} value={`template:${tpl.id}`}>
                      {tpl.name} ({tpl.code})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : templates.isLoading ? (
              <FormHint>Loading organization templates…</FormHint>
            ) : templates.isError ? (
              <FormHint>Could not load organization templates. Built-in designs still work.</FormHint>
            ) : (
              <FormHint>
                No saved org templates yet — built-in designs work immediately.
              </FormHint>
            )}
          </section>

          <section className="space-y-4 border-t border-[var(--tc-border)] pt-6">
            <div>
              <h3 className="text-sm font-semibold text-[var(--tc-fg)]">Options</h3>
              <p className="mt-1 text-xs text-[var(--tc-muted)]">Expiration, QR, and chain publish.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <Label htmlFor="cert-expires">Expiration</Label>
                <Input
                  id="cert-expires"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </Field>
              <details className="rounded-xl border border-[var(--tc-border)] px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-[var(--tc-fg)]">
                  Link a document{documentId ? " · selected" : ""}
                </summary>
                <div className="mt-3">
                  <DocumentPicker
                    organizationId={organizationId}
                    value={documentId}
                    onChange={setDocumentId}
                    label="Source document"
                  />
                </div>
              </details>
            </div>
            <div className="grid gap-3 rounded-xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)]/60 px-4 py-4 md:grid-cols-2">
              <label className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={createQr}
                  onChange={(e) => setCreateQr(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-[var(--tc-fg)]">Embed verification QR</span>
                  <span className="mt-0.5 block text-xs text-[var(--tc-muted)]">
                    Printed on the certificate PDF
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={publishToChain}
                  onChange={(e) => setPublishToChain(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-[var(--tc-fg)]">Publish to blockchain</span>
                  <span className="mt-0.5 block text-xs text-[var(--tc-muted)]">
                    Anchors the content hash on-chain
                  </span>
                </span>
              </label>
            </div>
          </section>

          {create.error ? (
            <FormError>{getCertificateErrorMessage(create.error)}</FormError>
          ) : null}
        </form>

        <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start">
          <div className="rounded-2xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-5 shadow-sm">
            <TemplateLayoutPreview
              organizationId={organizationId}
              layout={previewLayout}
              enabled={open}
              title="Live preview"
              subtitle={selectedDesignLabel(choice)}
            />
          </div>
        </aside>
      </div>
    </Modal>
  );
}
