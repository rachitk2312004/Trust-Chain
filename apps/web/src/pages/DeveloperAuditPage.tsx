import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { AuditTable, useDeveloperAudit } from "../features/developer";

type Draft = {
  action: string;
  targetType: string;
  success: string;
  q: string;
};

const empty: Draft = { action: "", targetType: "", success: "", q: "" };

export function DeveloperAuditPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const [draft, setDraft] = useState<Draft>(empty);
  const [applied, setApplied] = useState<Draft>(empty);

  const filters = useMemo(
    () => ({
      action: applied.action || undefined,
      targetType: applied.targetType || undefined,
      success:
        applied.success === "true"
          ? true
          : applied.success === "false"
            ? false
            : undefined,
      q: applied.q || undefined,
    }),
    [applied],
  );

  const audit = useDeveloperAudit(organizationId, filters, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Developer audit" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Developer audit" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Developer audit"
        description="Explore developer.* admin audit events for this organization."
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/developer/analytics" className="text-[var(--tc-accent)] hover:underline">
              Analytics
            </Link>
            <Link to="/developer" className="text-[var(--tc-accent)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />

      <form
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(draft);
        }}
      >
        <div>
          <Label htmlFor="action">Action</Label>
          <Input
            id="action"
            value={draft.action}
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
            placeholder="developer.key.create"
          />
        </div>
        <div>
          <Label htmlFor="targetType">Target type</Label>
          <Input
            id="targetType"
            value={draft.targetType}
            onChange={(e) => setDraft((d) => ({ ...d, targetType: e.target.value }))}
            placeholder="api_key"
          />
        </div>
        <div>
          <Label htmlFor="success">Success</Label>
          <select
            id="success"
            className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
            value={draft.success}
            onChange={(e) => setDraft((d) => ({ ...d, success: e.target.value }))}
          >
            <option value="">Any</option>
            <option value="true">Success</option>
            <option value="false">Failure</option>
          </select>
        </div>
        <div>
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            value={draft.q}
            onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
            placeholder="path, id, meta…"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit">Apply</Button>
        </div>
      </form>

      {audit.isError ? <FormError>{getApiErrorMessage(audit.error)}</FormError> : null}
      {audit.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading audit…</p>
      ) : (
        <AuditTable events={audit.data?.events ?? []} />
      )}
    </AppShellLayout>
  );
}
