import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Modal,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { useCreateQrTemplate, useQrTemplates } from "../features/qr/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getQrErrorMessage } from "../lib/qrErrors";
import { useSessionStore } from "../lib/sessionStore";

export function QrTemplatesPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const templates = useQrTemplates(organizationId);
  const create = useCreateQrTemplate(organizationId ?? "");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [foregroundColor, setForegroundColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [sizePx, setSizePx] = useState("512");
  const [isDefault, setIsDefault] = useState(false);

  function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    create.mutate(
      {
        name: name.trim(),
        foregroundColor,
        backgroundColor,
        sizePx: Number(sizePx) || 512,
        isDefault,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setIsDefault(false);
        },
      },
    );
  }

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="QR templates" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="QR templates"
        description="Render and print presets for QR generation."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setOpen(true)}>New template</Button>
            <Link to="/qr" className="self-center text-sm text-[var(--tc-accent)] hover:underline">
              Back
            </Link>
          </div>
        }
      />

      {templates.isError ? <FormError>{getQrErrorMessage(templates.error)}</FormError> : null}

      {templates.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading templates…</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Code</TH>
              <TH>Size</TH>
              <TH>Colors</TH>
              <TH>Default</TH>
            </TR>
          </THead>
          <TBody>
            {(templates.data ?? []).map((tpl) => (
              <TR key={tpl.publicCode}>
                <TD>{tpl.name}</TD>
                <TD className="font-mono text-xs">{tpl.publicCode}</TD>
                <TD>{tpl.sizePx}px · ECC {tpl.errorCorrection}</TD>
                <TD>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-sm border border-[var(--tc-border)]"
                      style={{ background: tpl.foregroundColor }}
                    />
                    <span
                      className="inline-block h-3 w-3 rounded-sm border border-[var(--tc-border)]"
                      style={{ background: tpl.backgroundColor }}
                    />
                  </span>
                </TD>
                <TD>{tpl.isDefault ? <Badge tone="success">Default</Badge> : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {!templates.isLoading && (templates.data?.length ?? 0) === 0 ? (
        <FormHint>No templates yet. Create one to use in the template selector.</FormHint>
      ) : null}

      <Modal
        open={open}
        title="Create template"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-template-form" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <form id="create-template-form" className="flex flex-col gap-3" onSubmit={onCreate}>
          <Field>
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="tpl-size">Size (px)</Label>
            <Input
              id="tpl-size"
              type="number"
              min={128}
              max={2048}
              value={sizePx}
              onChange={(e) => setSizePx(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="tpl-fg">Foreground</Label>
            <Input
              id="tpl-fg"
              value={foregroundColor}
              onChange={(e) => setForegroundColor(e.target.value)}
              pattern="#[0-9A-Fa-f]{6}"
            />
          </Field>
          <Field>
            <Label htmlFor="tpl-bg">Background</Label>
            <Input
              id="tpl-bg"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              pattern="#[0-9A-Fa-f]{6}"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Set as default template
          </label>
          <FormError>{create.error ? getQrErrorMessage(create.error) : null}</FormError>
        </form>
      </Modal>
    </AppShellLayout>
  );
}
