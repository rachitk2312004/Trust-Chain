import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { BookOpen, Code2, KeyRound, Webhook } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card, SectionHeader, StatCard } from "../components/ui";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  ServiceAccountTable,
  useDeveloperDashboard,
  useDeveloperServiceAccounts,
} from "../features/developer";

export function DeveloperDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const dashboard = useDeveloperDashboard(organizationId, canManage);
  const accounts = useDeveloperServiceAccounts(organizationId, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Developer" />
        <FormHint>Select an organization to manage developer credentials.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Developer" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Developer platform"
        description="API keys, webhooks, service accounts, and SDK metadata for this organization."
        actions={
          <div className="flex flex-wrap gap-2">
            {[
              ["/developer/keys", "API keys"],
              ["/developer/webhooks", "Webhooks"],
              ["/developer/explorer", "Explorer"],
              ["/developer/docs", "Docs"],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to as string}
                className="rounded-xl border border-tc-border bg-tc-surface px-3 py-1.5 text-sm hover:bg-tc-surface-2"
              >
                {label}
              </Link>
            ))}
          </div>
        }
      />

      {dashboard.isError ? <FormError>{getApiErrorMessage(dashboard.error)}</FormError> : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="API keys" value={dashboard.data?.counts.keys ?? "—"} icon={<KeyRound className="h-5 w-5" />} tone="info" />
        <StatCard label="Webhooks" value={dashboard.data?.counts.webhooks ?? "—"} icon={<Webhook className="h-5 w-5" />} />
        <StatCard label="Service accounts" value={dashboard.data?.counts.serviceAccounts ?? "—"} icon={<Code2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Deliveries" value={dashboard.data?.counts.deliveries ?? "—"} icon={<BookOpen className="h-5 w-5" />} />
      </div>

      <Card>
        <SectionHeader
          title="Service accounts"
          description="Machine identities for API automation"
          action={
            <Link to="/developer/sdk" className="text-sm text-tc-accent hover:underline">
              SDK guide
            </Link>
          }
        />
        <ServiceAccountTable
          organizationId={organizationId}
          accounts={accounts.data?.serviceAccounts ?? []}
        />
      </Card>
    </AppShellLayout>
  );
}
