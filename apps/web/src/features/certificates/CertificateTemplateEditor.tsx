import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Select,
  Textarea,
} from "@trustchain/ui";
import {
  defaultCertificateLayoutPreview,
  getCertificateErrorMessage,
} from "../../lib/certificateErrors";
import type { CertificateLayout, CertificateTemplate } from "../../types/api";
import { useUpdateTemplate } from "./hooks";

function asLayout(value: CertificateTemplate["layout"]): CertificateLayout {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as CertificateLayout;
  }
  return defaultCertificateLayoutPreview() as CertificateLayout;
}

export function CertificateTemplateEditor({
  organizationId,
  template,
  onSaved,
}: {
  organizationId: string;
  template: CertificateTemplate;
  onSaved?: () => void;
}) {
  const update = useUpdateTemplate(organizationId);
  const layout = asLayout(template.layout);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    layout.orientation === "landscape" ? "landscape" : "portrait",
  );
  const [pageSize, setPageSize] = useState<"A4" | "Letter">(
    layout.pageSize === "Letter" ? "Letter" : "A4",
  );
  const [titleTemplate, setTitleTemplate] = useState(
    String(layout.titleTemplate ?? "Certificate of Achievement"),
  );
  const [subtitleTemplate, setSubtitleTemplate] = useState(
    String(layout.subtitleTemplate ?? "{{organization_name}}"),
  );
  const [bodyTemplate, setBodyTemplate] = useState(
    String(
      layout.bodyTemplate ??
        "This certifies that {{recipient_name}} has been awarded this certificate ({{certificate_id}}).",
    ),
  );
  const [footerTemplate, setFooterTemplate] = useState(
    String(layout.footerTemplate ?? "Verify at {{verification_url}}"),
  );
  const [accentColor, setAccentColor] = useState(String(layout.accentColor ?? "#B45309"));
  const [backgroundColor, setBackgroundColor] = useState(
    String(layout.backgroundColor ?? "#FFFDF8"),
  );
  const [showQr, setShowQr] = useState(layout.showQr !== false);
  const [showLogo, setShowLogo] = useState(layout.showLogo !== false);
  const [showSignature, setShowSignature] = useState(layout.showSignature !== false);
  const [status, setStatus] = useState<"active" | "archived">(
    template.status === "archived" ? "archived" : "active",
  );

  useEffect(() => {
    const next = asLayout(template.layout);
    setName(template.name);
    setDescription(template.description ?? "");
    setOrientation(next.orientation === "landscape" ? "landscape" : "portrait");
    setPageSize(next.pageSize === "Letter" ? "Letter" : "A4");
    setTitleTemplate(String(next.titleTemplate ?? "Certificate of Achievement"));
    setSubtitleTemplate(String(next.subtitleTemplate ?? "{{organization_name}}"));
    setBodyTemplate(
      String(
        next.bodyTemplate ??
          "This certifies that {{recipient_name}} has been awarded this certificate ({{certificate_id}}).",
      ),
    );
    setFooterTemplate(String(next.footerTemplate ?? "Verify at {{verification_url}}"));
    setAccentColor(String(next.accentColor ?? "#B45309"));
    setBackgroundColor(String(next.backgroundColor ?? "#FFFDF8"));
    setShowQr(next.showQr !== false);
    setShowLogo(next.showLogo !== false);
    setShowSignature(next.showSignature !== false);
    setStatus(template.status === "archived" ? "archived" : "active");
    update.reset();
  }, [template]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    update.mutate(
      {
        templateId: template.id,
        name: name.trim(),
        description: description.trim() || null,
        status,
        layout: {
          ...layout,
          orientation,
          pageSize,
          titleTemplate: titleTemplate.trim(),
          subtitleTemplate: subtitleTemplate.trim(),
          bodyTemplate: bodyTemplate.trim(),
          footerTemplate: footerTemplate.trim(),
          accentColor,
          backgroundColor,
          showQr,
          showLogo,
          showSignature,
        },
      },
      { onSuccess: () => onSaved?.() },
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <FormHint>
        Placeholders: {"{{certificate_id}}"}, {"{{recipient_name}}"}, {"{{organization_name}}"},{" "}
        {"{{issue_date}}"}, {"{{expiration_date}}"}, {"{{verification_url}}"}
      </FormHint>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`tpl-name-${template.id}`}>Name</Label>
          <Input
            id={`tpl-name-${template.id}`}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor={`tpl-status-${template.id}`}>Status</Label>
          <Select
            id={`tpl-status-${template.id}`}
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "archived")}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
      </div>
      <Field>
        <Label htmlFor={`tpl-desc-${template.id}`}>Description</Label>
        <Textarea
          id={`tpl-desc-${template.id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`tpl-orient-${template.id}`}>Orientation</Label>
          <Select
            id={`tpl-orient-${template.id}`}
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as "portrait" | "landscape")}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor={`tpl-page-${template.id}`}>Page size</Label>
          <Select
            id={`tpl-page-${template.id}`}
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as "A4" | "Letter")}
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </Select>
        </Field>
      </div>
      <Field>
        <Label htmlFor={`tpl-title-${template.id}`}>Title template</Label>
        <Input
          id={`tpl-title-${template.id}`}
          value={titleTemplate}
          onChange={(e) => setTitleTemplate(e.target.value)}
        />
      </Field>
      <Field>
        <Label htmlFor={`tpl-sub-${template.id}`}>Subtitle template</Label>
        <Input
          id={`tpl-sub-${template.id}`}
          value={subtitleTemplate}
          onChange={(e) => setSubtitleTemplate(e.target.value)}
        />
      </Field>
      <Field>
        <Label htmlFor={`tpl-body-${template.id}`}>Body template</Label>
        <Textarea
          id={`tpl-body-${template.id}`}
          value={bodyTemplate}
          onChange={(e) => setBodyTemplate(e.target.value)}
          rows={4}
        />
      </Field>
      <Field>
        <Label htmlFor={`tpl-footer-${template.id}`}>Footer template</Label>
        <Input
          id={`tpl-footer-${template.id}`}
          value={footerTemplate}
          onChange={(e) => setFooterTemplate(e.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`tpl-accent-${template.id}`}>Accent color</Label>
          <Input
            id={`tpl-accent-${template.id}`}
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            pattern="#[0-9A-Fa-f]{6}"
          />
        </Field>
        <Field>
          <Label htmlFor={`tpl-bg-${template.id}`}>Background color</Label>
          <Input
            id={`tpl-bg-${template.id}`}
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            pattern="#[0-9A-Fa-f]{6}"
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showQr} onChange={(e) => setShowQr(e.target.checked)} />
          Show QR
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLogo}
            onChange={(e) => setShowLogo(e.target.checked)}
          />
          Show logo
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showSignature}
            onChange={(e) => setShowSignature(e.target.checked)}
          />
          Show signature
        </label>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save template"}
        </Button>
      </div>
      <FormError>{update.error ? getCertificateErrorMessage(update.error) : null}</FormError>
    </form>
  );
}
