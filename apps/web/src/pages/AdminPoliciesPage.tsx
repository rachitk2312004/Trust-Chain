import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import {
  PolicyEditor,
  PolicyEvaluationPanel,
  PolicyTable,
  useAdminPolicies,
} from "../features/admin";

export function AdminPoliciesPage() {
  const { isSuperAdmin } = usePermissions();
  const navigate = useNavigate();
  const [policyType, setPolicyType] = useState("");
  const [status, setStatus] = useState("");
  const policies = useAdminPolicies(
    {
      policyType: policyType || undefined,
      status: status || undefined,
      limit: 100,
    },
    isSuperAdmin,
  );

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Policies" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Policies"
        description="Centralized permission, quota, retention, workflow, feature, and organization policies."
        actions={
          <Link to="/admin" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <select
          className="h-10 rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 text-sm"
          value={policyType}
          onChange={(e) => setPolicyType(e.target.value)}
        >
          <option value="">All types</option>
          <option value="permission">permission</option>
          <option value="quota">quota</option>
          <option value="retention">retention</option>
          <option value="workflow">workflow</option>
          <option value="feature">feature</option>
          <option value="organization">organization</option>
        </select>
        <select
          className="h-10 rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </select>
      </div>

      <div className="mb-8">
        <PolicyEditor
          mode="create"
          onSaved={(policyId) => navigate(`/admin/policies/${policyId}`)}
        />
      </div>

      <div className="mb-8">
        <PolicyEvaluationPanel />
      </div>

      {policies.isError ? <FormError>{getApiErrorMessage(policies.error)}</FormError> : null}
      {policies.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading policies…</p>
      ) : (
        <PolicyTable policies={policies.data?.policies ?? []} />
      )}
    </AdminShellLayout>
  );
}
