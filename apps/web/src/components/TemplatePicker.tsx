import { FormHint, Label, Select } from "@trustchain/ui";
import { useQrTemplates } from "../features/qr/hooks";

export function TemplatePicker({
  organizationId,
  value,
  onChange,
  id = "template-picker",
}: {
  organizationId: string;
  value: string;
  onChange: (templatePublicCode: string) => void;
  id?: string;
}) {
  const templates = useQrTemplates(organizationId);

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>Template</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Default rendering</option>
        {(templates.data ?? []).map((tpl) => (
          <option key={tpl.publicCode} value={tpl.publicCode}>
            {tpl.name}
            {tpl.isDefault ? " (default)" : ""}
          </option>
        ))}
      </Select>
      {templates.isLoading ? <FormHint>Loading templates…</FormHint> : null}
    </div>
  );
}
