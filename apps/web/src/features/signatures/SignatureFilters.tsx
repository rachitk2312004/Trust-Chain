import { Button, Field, Input, Label, Select } from "@trustchain/ui";

export type SignatureFilterState = {
  search: string;
  status: string;
  algorithm: string;
};

export function SignatureFilters({
  value,
  onChange,
  onClear,
}: {
  value: SignatureFilterState;
  onChange: (next: SignatureFilterState) => void;
  onClear?: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <Field className="min-w-[14rem] flex-1">
        <Label htmlFor="sig-search">Search</Label>
        <Input
          id="sig-search"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Public ID, algorithm, document, or certificate"
        />
      </Field>
      <Field>
        <Label htmlFor="sig-status">Status</Label>
        <Select
          id="sig-status"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
        </Select>
      </Field>
      <Field>
        <Label htmlFor="sig-algorithm">Algorithm</Label>
        <Select
          id="sig-algorithm"
          value={value.algorithm}
          onChange={(e) => onChange({ ...value, algorithm: e.target.value })}
        >
          <option value="">All</option>
          <option value="RSA-SHA256">RSA-SHA256</option>
          <option value="ECDSA-P256-SHA256">ECDSA-P256-SHA256</option>
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
