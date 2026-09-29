import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import { PageHeader } from "../components/PageHeader";
import { CertificatePresetGallery } from "../features/certificates/CertificatePresetGallery";
import {
  CertificateTemplateEditor,
  useCertificateTemplates,
  useCreateTemplate,
} from "../features/certificates";
import type { CertificateLayoutPreset } from "@trustchain/config";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import {
  defaultCertificateLayoutPreview,
  getCertificateErrorMessage,
  slugifyCertificateTemplateCode,
} from "../lib/certificateErrors";
import { useSessionStore } from "../lib/sessionStore";

export function CertificateTemplatesPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const templates = useCertificateTemplates(organizationId);
  const create = useCreateTemplate(organizationId ?? "");
  const feedback = useFeedback();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  function resetCreate() {
    setCode("");
    setName("");
    setDescription("");
    setOrientation("portrait");
    create.reset();
  }

  function onUsePreset(preset: CertificateLayoutPreset) {
    if (!organizationId || create.isPending) return;
    create.mutate(
      {
        code: preset.code,
        name: preset.name,
        description: preset.description,
        layout: { ...preset.layout },
      },
      {
        onSuccess: (tpl) => {
          setSelectedId(tpl.id);
          feedback.success(`Added template “${preset.name}”`);
        },
      },
    );
  }

  function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    create.mutate(
      {
        code: slugifyCertificateTemplateCode(code),
        name: name.trim(),
        description: description.trim() || null,
        layout: {
          ...defaultCertificateLayoutPreview(),
          orientation,
        },
      },
      {
        onSuccess: (tpl) => {
          setOpen(false);
          resetCreate();
          setSelectedId(tpl.id);
          feedback.success("Template created");
        },
      },
    );
  }

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Certificate templates" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  const selected = (templates.data ?? []).find((t) => t.id === selectedId) ?? templates.data?.[0];
  const existingCodes = new Set((templates.data ?? []).map((t) => t.code));

  return (
    <AppShellLayout>
      <PageHeader
        title="Certificate templates"
        description="Layout presets with placeholders, orientation, and branding toggles."
        actions={
          <div className="flex gap-2">
            <Can capability="certificates.manage" organizationId={organizationId}>
              <Button onClick={() => setOpen(true)}>New template</Button>
            </Can>
            <Link
              to="/certificates"
              className="self-center text-sm text-[var(--tc-accent)] hover:underline"
            >
              Back
            </Link>
          </div>
        }
      />

      {templates.isError ? (
        <FormError>{getCertificateErrorMessage(templates.error)}</FormError>
      ) : null}

      {templates.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading templates…</p>
      ) : (
        <>
          <section className="mb-6 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--tc-fg)]">Built-in design gallery</h2>
              <p className="text-xs text-[var(--tc-muted)]">
                Six print-ready layouts (landscape and portrait) with balanced margins, typography,
                and preset-specific borders. Click “Use preset” to add one to your organization.
              </p>
            </div>
            <Can capability="certificates.manage" organizationId={organizationId}>
              <CertificatePresetGallery
                disabled={create.isPending}
                existingCodes={existingCodes}
                onUse={onUsePreset}
              />
            </Can>
          </section>

          <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
              <CardDescription>{templates.data?.length ?? 0} presets</CardDescription>
            </CardHeader>
            <ul className="flex flex-col gap-1">
              {(templates.data ?? []).map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm ${
                      selected?.id === tpl.id
                        ? "bg-[var(--tc-surface-2)] font-medium"
                        : "hover:bg-[var(--tc-surface-2)]"
                    }`}
                    onClick={() => setSelectedId(tpl.id)}
                  >
                    <span className="truncate">{tpl.name}</span>
                    <Badge tone={tpl.status === "active" ? "success" : "neutral"}>
                      {tpl.status}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
            {(templates.data?.length ?? 0) === 0 ? (
              <FormHint>No templates yet. Create one to customize certificate layouts.</FormHint>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selected ? selected.name : "Template editor"}</CardTitle>
              <CardDescription>
                {selected
                  ? `Code ${selected.code}`
                  : "Select a template to edit placeholders and layout."}
              </CardDescription>
            </CardHeader>
            {selected ? (
              <Can
                capability="certificates.manage"
                organizationId={organizationId}
                fallback={<FormHint>You can view templates but need admin access to edit.</FormHint>}
              >
                <CertificateTemplateEditor
                  organizationId={organizationId}
                  template={selected}
                  onSaved={() => feedback.success("Template saved")}
                />
              </Can>
            ) : (
              <FormHint>Select or create a template.</FormHint>
            )}
          </Card>
          </div>
        </>
      )}

      <Modal
        open={open}
        title="Create certificate template"
        onClose={() => {
          setOpen(false);
          resetCreate();
        }}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                resetCreate();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="create-cert-template-form" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <form id="create-cert-template-form" className="flex flex-col gap-3" onSubmit={onCreate}>
          <Field>
            <Label htmlFor="cert-tpl-code">Code</Label>
            <Input
              id="cert-tpl-code"
              required
              minLength={2}
              maxLength={64}
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="completion-v1"
            />
            <FormHint>Letters, numbers, and hyphens. Spaces become hyphens.</FormHint>
          </Field>
          <Field>
            <Label htmlFor="cert-tpl-name">Name</Label>
            <Input
              id="cert-tpl-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="cert-tpl-desc">Description</Label>
            <Textarea
              id="cert-tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
          <Field>
            <Label htmlFor="cert-tpl-orient">Orientation</Label>
            <Select
              id="cert-tpl-orient"
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as "portrait" | "landscape")}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </Select>
          </Field>
          <FormError>{create.error ? getCertificateErrorMessage(create.error) : null}</FormError>
        </form>
      </Modal>
    </AppShellLayout>
  );
}
