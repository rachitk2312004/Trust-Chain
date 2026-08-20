import { Button, Field, Input, Label, Select } from "@trustchain/ui";

export type CertificateFilterState = {
  search: string;
  status: string;
};

export function CertificateFilters({
  value,
  onChange,
  onClear,
}: {
  value: CertificateFilterState;
  onChange: (next: CertificateFilterState) => void;
  onClear?: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <Field className="min-w-[14rem] flex-1">
        <Label htmlFor="cert-search">Search</Label>
        <Input
          id="cert-search"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Title, recipient, or public ID"
        />
      </Field>
      <Field>
        <Label htmlFor="cert-status">Status</Label>
        <Select
          id="cert-status"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          <option value="">All</option>
          <option value="issued">Issued</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
          <option value="draft">Draft</option>
        </Select>
      </Field>
      {onClear ? (
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
