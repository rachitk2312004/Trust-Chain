import { useState } from "react";
import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  AccessReviewTable,
  SamlConfigurationCard,
  ScimConfigurationCard,
  useEnterpriseDashboard,
  useUpsertSaml,
  useUpsertScim,
} from "../features/enterprise";

export function EnterpriseDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const dashboard = useEnterpriseDashboard(organizationId, canManage);
  const saml = useUpsertSaml();
  const scim = useUpsertScim();
  const [lastToken, setLastToken] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Enterprise" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Enterprise" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const data = dashboard.data;

  return (
    <AppShellLayout>
      <PageHeader
        title="Enterprise identity"
        description="SSO (SAML), SCIM provisioning, ABAC, delegated admin, and access reviews."
        actions={
          <Link to="/enterprise/roles" className="text-sm text-[var(--tc-accent)] hover:underline">
            Roles
          </Link>
        }
      />

      {dashboard.isError ? <FormError>{getApiErrorMessage(dashboard.error)}</FormError> : null}
      {saml.isError ? <FormError>{getApiErrorMessage(saml.error)}</FormError> : null}
      {scim.isError ? <FormError>{getApiErrorMessage(scim.error)}</FormError> : null}

      {dashboard.isLoading || !data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading enterprise…</p>
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Roles</div>
              <div className="mt-1 text-3xl font-semibold">{data.roles.length}</div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">ABAC policies</div>
              <div className="mt-1 text-3xl font-semibold">{data.abacPolicies.length}</div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Delegates</div>
              <div className="mt-1 text-3xl font-semibold">{data.delegates.length}</div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <SamlConfigurationCard
              saml={data.saml}
              pending={saml.isPending}
              onSave={(input) =>
                saml.mutate({
                  organizationId,
                  ...input,
                })
              }
            />
            <ScimConfigurationCard
              scim={data.scim}
              pending={scim.isPending}
              lastToken={lastToken}
              onSave={(input) =>
                scim.mutate(
                  {
                    organizationId,
                    baseUrl: input.baseUrl,
                    status: input.status,
                    rotateToken: input.rotateToken,
                    provisionUser: input.provisionEmail
                      ? {
                          userName: input.provisionEmail,
                          emails: [{ value: input.provisionEmail, primary: true }],
                          externalId: input.provisionEmail,
                        }
                      : undefined,
                  },
                  {
                    onSuccess: (res) => setLastToken(res.bearerToken),
                  },
                )
              }
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Access reviews
            </h2>
            <AccessReviewTable reviews={data.accessReviews} />
          </section>
        </div>
      )}
    </AppShellLayout>
  );
}
