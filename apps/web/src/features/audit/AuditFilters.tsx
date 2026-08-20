import { Button, Input, Label } from "@trustchain/ui";

export type AuditFiltersState = {
  action: string;
  actorUserId: string;
  resourceType: string;
  resourceId: string;
  correlationId: string;
  requestId: string;
  source: string;
  success: string;
  actorIp: string;
  from: string;
  to: string;
};

export const emptyAuditFilters: AuditFiltersState = {
  action: "",
  actorUserId: "",
  resourceType: "",
  resourceId: "",
  correlationId: "",
  requestId: "",
  source: "",
  success: "",
  actorIp: "",
  from: "",
  to: "",
};

export function AuditFilters({
  value,
  onChange,
  onApply,
}: {
  value: AuditFiltersState;
  onChange: (next: AuditFiltersState) => void;
  onApply: () => void;
}) {
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
    >
      <Field label="Action" id="action">
        <Input
          id="action"
          value={value.action}
          onChange={(e) => onChange({ ...value, action: e.target.value })}
        />
      </Field>
      <Field label="Source" id="source">
        <Input
          id="source"
          value={value.source}
          onChange={(e) => onChange({ ...value, source: e.target.value })}
          placeholder="admin, document…"
        />
      </Field>
      <Field label="Actor user id" id="actorUserId">
        <Input
          id="actorUserId"
          value={value.actorUserId}
          onChange={(e) => onChange({ ...value, actorUserId: e.target.value })}
        />
      </Field>
      <Field label="Actor IP" id="actorIp">
        <Input
          id="actorIp"
          value={value.actorIp}
          onChange={(e) => onChange({ ...value, actorIp: e.target.value })}
        />
      </Field>
      <Field label="Resource type" id="resourceType">
        <Input
          id="resourceType"
          value={value.resourceType}
          onChange={(e) => onChange({ ...value, resourceType: e.target.value })}
        />
      </Field>
      <Field label="Resource id" id="resourceId">
        <Input
          id="resourceId"
          value={value.resourceId}
          onChange={(e) => onChange({ ...value, resourceId: e.target.value })}
        />
      </Field>
      <Field label="Correlation id" id="correlationId">
        <Input
          id="correlationId"
          value={value.correlationId}
          onChange={(e) => onChange({ ...value, correlationId: e.target.value })}
        />
      </Field>
      <Field label="Request id" id="requestId">
        <Input
          id="requestId"
          value={value.requestId}
          onChange={(e) => onChange({ ...value, requestId: e.target.value })}
        />
      </Field>
      <Field label="Success" id="success">
        <select
          id="success"
          className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
          value={value.success}
          onChange={(e) => onChange({ ...value, success: e.target.value })}
        >
          <option value="">Any</option>
          <option value="true">Success</option>
          <option value="false">Failure</option>
        </select>
      </Field>
      <Field label="From" id="from">
        <Input
          id="from"
          type="datetime-local"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </Field>
      <Field label="To" id="to">
        <Input
          id="to"
          type="datetime-local"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </Field>
      <div className="flex items-end">
        <Button type="submit">Apply filters</Button>
      </div>
    </form>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
