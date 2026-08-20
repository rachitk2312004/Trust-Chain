import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  AuditFilters,
  AuditLogViewer,
  auditFiltersToParams,
  useAdminAudit,
  type AuditFiltersState,
} from "../features/admin";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";

const emptyFilters: AuditFiltersState = {
  action: "",
  targetType: "",
  success: "",
  q: "",
};

export function AdminAuditPage() {
  const { isSuperAdmin } = usePermissions();
  const [draft, setDraft] = useState<AuditFiltersState>(emptyFilters);
  const [applied, setApplied] = useState<AuditFiltersState>(emptyFilters);
  const params = useMemo(() => auditFiltersToParams(applied), [applied]);
  const audit = useAdminAudit(params, isSuperAdmin);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Admin audit" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Admin audit"
        description="Browse platform administration audit events."
        actions={
          <Link to="/admin" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />
      <AuditFilters value={draft} onChange={setDraft} onApply={() => setApplied(draft)} />
      {audit.isError ? <FormError>{getApiErrorMessage(audit.error)}</FormError> : null}
      {audit.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading audit…</p>
      ) : (
        <AuditLogViewer events={audit.data?.events ?? []} />
      )}
    </AdminShellLayout>
  );
}
