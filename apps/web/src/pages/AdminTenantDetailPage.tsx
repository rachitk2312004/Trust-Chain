import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  TenantLifecycleDialog,
  TenantQuotaPanel,
  TenantTransferDialog,
  useAdminTenant,
} from "../features/admin";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";

export function AdminTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { isSuperAdmin } = usePermissions();
  const detail = useAdminTenant(tenantId, isSuperAdmin);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Tenant detail" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  if (!tenantId) {
    return (
      <AdminShellLayout>
        <PageHeader title="Tenant detail" />
        <FormHint>Missing tenant id.</FormHint>
      </AdminShellLayout>
    );
  }

  const tenant = detail.data?.tenant;

  return (
    <AdminShellLayout>
      <PageHeader
        title={tenant?.name ?? "Tenant detail"}
        description={tenant ? `${tenant.slug} · ${tenant.status}` : "Inspect tenant"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/tenants" className="text-sm text-[var(--tc-accent)] hover:underline">
              All tenants
            </Link>
            {tenant ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setLifecycleOpen(true)}>
                  Lifecycle
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setTransferOpen(true)}>
                  Transfer
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {detail.isError ? <FormError>{getApiErrorMessage(detail.error)}</FormError> : null}
      {detail.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading tenant…</p>
      ) : detail.data && tenant ? (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>
                <Badge
                  tone={
                    tenant.status === "active"
                      ? "success"
                      : tenant.status === "suspended"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {tenant.status}
                </Badge>
              </CardDescription>
            </CardHeader>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--tc-muted)]">ID</dt>
                <dd className="font-mono text-xs">{tenant.id}</dd>
              </div>
              <div>
                <dt className="text-[var(--tc-muted)]">Slug</dt>
                <dd className="font-mono text-xs">{tenant.slug}</dd>
              </div>
              <div>
                <dt className="text-[var(--tc-muted)]">Members</dt>
                <dd>{detail.data.counts.memberships}</dd>
              </div>
              <div>
                <dt className="text-[var(--tc-muted)]">Child orgs</dt>
                <dd>{detail.data.counts.children}</dd>
              </div>
              <div>
                <dt className="text-[var(--tc-muted)]">Documents</dt>
                <dd>{detail.data.counts.documents}</dd>
              </div>
              <div>
                <dt className="text-[var(--tc-muted)]">Certificates / signatures</dt>
                <dd>
                  {detail.data.counts.certificates} / {detail.data.counts.signatures}
                </dd>
              </div>
            </dl>
          </Card>

          <TenantQuotaPanel tenantId={tenantId} quotas={detail.data.quotas} />

          <Card>
            <CardHeader>
              <CardTitle>Lifecycle events</CardTitle>
              <CardDescription>Recent tenant administration actions</CardDescription>
            </CardHeader>
            {detail.data.lifecycle.length === 0 ? (
              <FormHint>No lifecycle events yet.</FormHint>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.data.lifecycle.map((event) => (
                  <li key={event.id} className="flex justify-between gap-3">
                    <span className="font-mono text-xs">{event.eventType}</span>
                    <span className="text-[var(--tc-muted)]">
                      {event.fromStatus ?? "—"} → {event.toStatus ?? "—"} ·{" "}
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <TenantLifecycleDialog
            open={lifecycleOpen}
            onClose={() => setLifecycleOpen(false)}
            tenantId={tenantId}
            tenantName={tenant.name}
            currentStatus={tenant.status}
          />
          <TenantTransferDialog
            open={transferOpen}
            onClose={() => setTransferOpen(false)}
            tenantId={tenantId}
            tenantName={tenant.name}
          />
        </div>
      ) : null}
    </AdminShellLayout>
  );
}
