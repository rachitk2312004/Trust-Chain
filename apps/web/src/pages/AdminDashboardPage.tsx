import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import {
  Building2,
  Flag,
  ScrollText,
  Shield,
  Users,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card, EmptyState, SectionHeader, StatCard } from "../components/ui";
import { AuditLogViewer, useAdminDashboard } from "../features/admin";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";

const adminLinks = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/organizations", label: "Organizations" },
  { to: "/admin/tenants", label: "Tenants" },
  { to: "/admin/permissions", label: "Permissions" },
  { to: "/admin/feature-flags", label: "Feature flags" },
  { to: "/admin/audit", label: "Audit" },
  { to: "/admin/health", label: "Health" },
  { to: "/admin/inspection", label: "Inspection" },
  { to: "/admin/configuration", label: "Configuration" },
  { to: "/admin/policies", label: "Policies" },
  { to: "/admin/analytics", label: "Analytics" },
];

export function AdminDashboardPage() {
  const { isSuperAdmin } = usePermissions();
  const dashboard = useAdminDashboard(isSuperAdmin);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Administration" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Administration"
        description="Platform users, organizations, roles, permissions, and feature flags."
        actions={
          <div className="flex flex-wrap gap-2">
            {adminLinks.slice(0, 4).map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-xl border border-tc-border bg-tc-surface px-3 py-1.5 text-sm text-tc-fg hover:bg-tc-surface-2"
              >
                {l.label}
              </Link>
            ))}
          </div>
        }
      />

      {dashboard.isError ? <FormError>{getApiErrorMessage(dashboard.error)}</FormError> : null}

      {dashboard.isLoading ? (
        <p className="text-sm text-tc-muted">Loading dashboard…</p>
      ) : dashboard.data ? (
        <div className="flex flex-col gap-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Users" value={dashboard.data.summary.users} icon={<Users className="h-5 w-5" />} tone="info" />
            <StatCard label="Organizations" value={dashboard.data.summary.organizations} icon={<Building2 className="h-5 w-5" />} />
            <StatCard label="Roles" value={dashboard.data.summary.roles} icon={<Shield className="h-5 w-5" />} tone="success" />
            <StatCard label="Feature flags" value={dashboard.data.summary.featureFlags} icon={<Flag className="h-5 w-5" />} tone="warning" />
            <StatCard label="Audit events" value={dashboard.data.summary.recentAuditEvents} icon={<ScrollText className="h-5 w-5" />} />
          </div>

          <div className="flex flex-wrap gap-2">
            {adminLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full border border-tc-border px-3 py-1 text-xs font-medium text-tc-muted hover:border-emerald-500/40 hover:text-tc-fg"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <Card>
            <SectionHeader title="Recent audit" description="Latest administration actions" />
            {dashboard.data.recentAudit?.length ? (
              <AuditLogViewer events={dashboard.data.recentAudit} />
            ) : (
              <EmptyState title="No audit events" description="Administration actions will appear here." />
            )}
          </Card>
        </div>
      ) : null}
    </AdminShellLayout>
  );
}
