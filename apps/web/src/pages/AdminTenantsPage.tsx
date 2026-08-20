import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button, FormError, FormHint, Input } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  AdminEditDialog,
  AdminLifecycleDialog,
  TenantTable,
  useAdminTenants,
  useAdminUsers,
  useArchiveAdminTenant,
  useCreateAdminTenant,
  usePatchAdminTenant,
  useRestoreAdminTenant,
  useSuspendAdminTenant,
} from "../features/admin";
import type { AdminLifecycleTarget } from "../features/admin/AdminEntityDialog";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { slugifyName } from "../lib/slugify";
import { useFeedback } from "../hooks/useFeedback";
import { usePermissions } from "../hooks/usePermissions";
import type { AdminTenantSummary } from "../types/api";

export function AdminTenantsPage() {
  const { isSuperAdmin } = usePermissions();
  const tenants = useAdminTenants({ limit: 100 }, isSuperAdmin);
  const create = useCreateAdminTenant();
  const suspend = useSuspendAdminTenant();
  const restore = useRestoreAdminTenant();
  const archive = useArchiveAdminTenant();
  const feedback = useFeedback();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [lifecycleTarget, setLifecycleTarget] = useState<AdminLifecycleTarget | null>(null);
  const [editTenant, setEditTenant] = useState<AdminTenantSummary | null>(null);
  const patchTenant = usePatchAdminTenant(editTenant?.id ?? "");

  const ownerLookup = useAdminUsers(
    { search: ownerEmail.trim().toLowerCase(), limit: 5 },
    isSuperAdmin && ownerEmail.includes("@"),
  );

  const ownerMatch = useMemo(() => {
    const email = ownerEmail.trim().toLowerCase();
    if (!email.includes("@")) return null;
    return (ownerLookup.data?.users ?? []).find((u) => u.email.toLowerCase() === email) ?? null;
  }, [ownerEmail, ownerLookup.data?.users]);

  const slugPreview = slug.trim() ? slugifyName(slug) : name.trim() ? slugifyName(name) : "";

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Tenants" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  const lifecyclePending = suspend.isPending || restore.isPending || archive.isPending;
  const lifecycleError = suspend.error ?? restore.error ?? archive.error;

  const existingSlugMatch = useMemo(() => {
    const normalizedSlug = slug.trim() ? slugifyName(slug) : slugifyName(name);
    if (!normalizedSlug) return null;
    return (tenants.data?.tenants ?? []).find((t) => t.slug === normalizedSlug) ?? null;
  }, [name, slug, tenants.data?.tenants]);

  function onProvision() {
    const normalizedSlug = slug.trim() ? slugifyName(slug) : slugifyName(name);
    const email = ownerEmail.trim().toLowerCase();

    if (!ownerMatch) {
      feedback.error(
        new Error("Org admin account not found"),
        "That email is not registered yet. Ask them to sign up at Register first.",
      );
      return;
    }

    if (existingSlugMatch) {
      feedback.error(
        new Error("Tenant already exists"),
        `"${existingSlugMatch.name}" already uses slug /${existingSlugMatch.slug}. Open that tenant and use Transfer to assign ${email} as org admin.`,
      );
      return;
    }

    create.mutate(
      {
        name: name.trim(),
        slug: normalizedSlug || undefined,
        ownerUserId: ownerMatch.id,
        ownerEmail: email,
      },
      {
        onSuccess: () => {
          feedback.success("Tenant provisioned", "The organization admin can sign in and manage their workspace.");
          setName("");
          setSlug("");
          setOwnerEmail("");
        },
        onError: (err) => feedback.error(err, "Create failed"),
      },
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Tenants"
        description="Provision organizations for customer org admins. You stay on the platform console — the owner receives org_admin access."
        actions={
          <Link to="/admin" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-tc-muted">
        <p className="font-medium text-tc-fg">How to set the org admin email</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            The person must have a TrustChain account first — use{" "}
            <Link to="/register" className="text-[var(--tc-accent)] hover:underline">
              Register
            </Link>{" "}
            (or check{" "}
            <Link to="/admin/users" className="text-[var(--tc-accent)] hover:underline">
              Admin → Users
            </Link>
            ).
          </li>
          <li>Enter their login email below as <strong className="text-tc-fg">Org admin email</strong>.</li>
          <li>Leave slug empty to auto-generate (e.g. <code className="text-xs">northstar-technologies</code>).</li>
        </ol>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Organization name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northstar Technologies" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Slug (optional)</label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={slugPreview || "northstar-tech"}
          />
          {slugPreview ? (
            <p className="mt-1 text-[11px] text-tc-muted">Will use: /{slugPreview}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Org admin email</label>
          <Input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="admin@customer.com"
          />
          {ownerEmail.includes("@") && !ownerLookup.isLoading ? (
            ownerMatch ? (
              <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                Account found — {ownerMatch.firstName ?? ownerMatch.email}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                No account yet — ask them to register first.
              </p>
            )
          ) : null}
        </div>
        <Button
          disabled={!name.trim() || !ownerEmail.trim() || !ownerMatch || create.isPending}
          onClick={onProvision}
        >
          {create.isPending ? "Provisioning…" : "Provision tenant"}
        </Button>
      </div>
      {existingSlugMatch ? (
        <FormHint>
          Slug /{existingSlugMatch.slug} is already taken by{" "}
          <Link to={`/admin/tenants/${existingSlugMatch.id}`} className="text-[var(--tc-accent)] hover:underline">
            {existingSlugMatch.name}
          </Link>
          . Use <strong>Transfer</strong> there to assign a new org admin instead of creating a duplicate.
        </FormHint>
      ) : null}
      <FormError>{create.error ? getApiErrorMessage(create.error) : null}</FormError>

      {tenants.isError ? <FormError>{getApiErrorMessage(tenants.error)}</FormError> : null}
      {tenants.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading tenants…</p>
      ) : (
        <TenantTable
          tenants={tenants.data?.tenants ?? []}
          onEdit={setEditTenant}
          onLifecycle={(tenant) =>
            setLifecycleTarget({
              kind: "tenant",
              id: tenant.id,
              label: tenant.name,
              status: tenant.status,
            })
          }
        />
      )}

      <AdminLifecycleDialog
        open={Boolean(lifecycleTarget)}
        onClose={() => setLifecycleTarget(null)}
        target={lifecycleTarget}
        pending={lifecyclePending}
        error={lifecycleError}
        onSuspend={(input) =>
          suspend.mutate(
            { tenantId: input.id, reason: input.reason },
            {
              onSuccess: () => {
                feedback.success("Tenant suspended");
                setLifecycleTarget(null);
              },
            },
          )
        }
        onRestore={(input) =>
          restore.mutate(
            { tenantId: input.id, reason: input.reason },
            {
              onSuccess: () => {
                feedback.success("Tenant restored");
                setLifecycleTarget(null);
              },
            },
          )
        }
        onArchive={(input) =>
          archive.mutate(
            { tenantId: input.id, reason: input.reason },
            {
              onSuccess: () => {
                feedback.success("Tenant archived");
                setLifecycleTarget(null);
              },
            },
          )
        }
      />

      <AdminEditDialog
        open={Boolean(editTenant)}
        onClose={() => setEditTenant(null)}
        title="Edit tenant"
        pending={patchTenant.isPending}
        error={patchTenant.error}
        fields={
          editTenant
            ? [{ key: "name", label: "Name", value: editTenant.name }]
            : []
        }
        onSave={(values) => {
          if (!editTenant) return;
          patchTenant.mutate(
            { name: (values.name ?? "").trim() },
            {
              onSuccess: () => {
                feedback.success("Tenant updated");
                setEditTenant(null);
              },
            },
          );
        }}
      />
    </AdminShellLayout>
  );
}
