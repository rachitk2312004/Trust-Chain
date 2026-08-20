import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { OrganizationTree, useOrgHierarchy } from "../features/organization-platform";

export function OrganizationHierarchyPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const hierarchy = useOrgHierarchy(organizationId, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Organization hierarchy" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Organization hierarchy" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Organization hierarchy"
        description="Business units, departments, and cost centers with inherited policies."
        actions={
          <Link to="/organization" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      {hierarchy.isError ? <FormError>{getApiErrorMessage(hierarchy.error)}</FormError> : null}

      {hierarchy.isLoading || !hierarchy.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading hierarchy…</p>
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Business units</div>
              <div className="mt-1 text-3xl font-semibold">{hierarchy.data.counts.businessUnits}</div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Departments</div>
              <div className="mt-1 text-3xl font-semibold">{hierarchy.data.counts.departments}</div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Cost centers</div>
              <div className="mt-1 text-3xl font-semibold">{hierarchy.data.counts.costCenters}</div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Tree
            </h2>
            <OrganizationTree tree={hierarchy.data.tree} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Policy inheritance
            </h2>
            {hierarchy.data.inheritance.length === 0 ? (
              <FormHint>No department policies to resolve.</FormHint>
            ) : (
              <ul className="space-y-2">
                {hierarchy.data.inheritance.map((item) => (
                  <li
                    key={item.departmentId}
                    className="rounded border border-[var(--tc-border)] px-3 py-2 text-sm"
                  >
                    <div className="font-medium">{item.name}</div>
                    <div className="font-mono text-xs text-[var(--tc-muted)]">
                      chain: {item.chain.map((id) => id.slice(0, 8)).join(" → ")}
                    </div>
                    <pre className="mt-1 overflow-x-auto text-xs">
                      {JSON.stringify(item.inheritedPolicy, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShellLayout>
  );
}
