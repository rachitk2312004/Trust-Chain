import { Button, Input, Select } from "@trustchain/ui";
import type { AdminAuditFilterParams } from "../../types/api";

export type AuditFiltersState = {
  action: string;
  targetType: string;
  success: "" | "true" | "false";
  q: string;
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
    <div className="mb-4 flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium">Action</label>
        <Input
          value={value.action}
          onChange={(e) => onChange({ ...value, action: e.target.value })}
          placeholder="admin.tenant.suspend"
          className="min-w-[14rem]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Target type</label>
        <Input
          value={value.targetType}
          onChange={(e) => onChange({ ...value, targetType: e.target.value })}
          placeholder="tenant"
          className="w-36"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Success</label>
        <Select
          value={value.success}
          onChange={(e) =>
            onChange({ ...value, success: e.target.value as AuditFiltersState["success"] })
          }
        >
          <option value="">Any</option>
          <option value="true">Ok</option>
          <option value="false">Fail</option>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Search</label>
        <Input
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="meta / ids"
          className="min-w-[10rem]"
        />
      </div>
      <Button size="sm" onClick={onApply}>
        Apply
      </Button>
    </div>
  );
}

export function auditFiltersToParams(filters: AuditFiltersState): AdminAuditFilterParams {
  return {
    action: filters.action.trim() || undefined,
    targetType: filters.targetType.trim() || undefined,
    success:
      filters.success === "" ? undefined : filters.success === "true",
    q: filters.q.trim() || undefined,
    limit: 100,
  };
}
