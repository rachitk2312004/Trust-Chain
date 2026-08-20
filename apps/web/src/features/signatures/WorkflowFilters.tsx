import { Button, Field, Input, Label, Select } from "@trustchain/ui";

export type WorkflowFilterState = {
  search: string;
  status: string;
  workflowType: string;
};

export function WorkflowFilters({
  value,
  onChange,
  onClear,
}: {
  value: WorkflowFilterState;
  onChange: (next: WorkflowFilterState) => void;
  onClear?: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <Field className="min-w-[14rem] flex-1">
        <Label htmlFor="wf-search">Search</Label>
        <Input
          id="wf-search"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Title or public ID"
        />
      </Field>
      <Field>
        <Label htmlFor="wf-status">Status</Label>
        <Select
          id="wf-status"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </Select>
      </Field>
      <Field>
        <Label htmlFor="wf-type">Type</Label>
        <Select
          id="wf-type"
          value={value.workflowType}
          onChange={(e) => onChange({ ...value, workflowType: e.target.value })}
        >
          <option value="">All</option>
          <option value="sequential">Sequential</option>
          <option value="parallel">Parallel</option>
          <option value="threshold">Threshold</option>
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
