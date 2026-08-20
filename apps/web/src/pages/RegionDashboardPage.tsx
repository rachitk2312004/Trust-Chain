import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  FailoverDialog,
  RegionTable,
  RoutingPolicyPanel,
  useCreateRegion,
  useRegionFailover,
  useRegionRouting,
  useRegions,
} from "../features/regions";

export function RegionDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const regions = useRegions(canManage);
  const routing = useRegionRouting(organizationId, { dataClass: "pii" }, canManage);
  const create = useCreateRegion();
  const failover = useRegionFailover();
  const [failoverOpen, setFailoverOpen] = useState(false);
  const [code, setCode] = useState("eu-west-1");
  const [name, setName] = useState("EU West");
  const [jurisdiction, setJurisdiction] = useState("EU");
  const [endpointUrl, setEndpointUrl] = useState("https://eu.trustchain.local");
  const [message, setMessage] = useState<string | null>(null);

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Regions" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Multi-region"
        description="Region registration, residency-aware routing, replication, and failover."
        actions={
          <div className="flex items-center gap-3">
            <Link
              to="/regions/residency"
              className="text-sm text-[var(--tc-accent)] hover:underline"
            >
              Residency report
            </Link>
            <Button type="button" variant="ghost" onClick={() => setFailoverOpen(true)}>
              Failover
            </Button>
          </div>
        }
      />

      {regions.isError ? <FormError>{getApiErrorMessage(regions.error)}</FormError> : null}
      {create.isError ? <FormError>{getApiErrorMessage(create.error)}</FormError> : null}
      {failover.isError ? <FormError>{getApiErrorMessage(failover.error)}</FormError> : null}
      {routing.isError ? <FormError>{getApiErrorMessage(routing.error)}</FormError> : null}
      {message ? <FormHint>{message}</FormHint> : null}

      <section className="mb-8">
        <RoutingPolicyPanel decision={routing.data} loading={routing.isLoading} />
      </section>

      {isSuperAdmin ? (
        <section className="mb-8">
          <form
            className="grid gap-3 rounded border border-[var(--tc-border)] p-4 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({
                code,
                name,
                jurisdiction,
                endpointUrl,
                organizationId: organizationId ?? undefined,
                residency: {
                  mode: "strict",
                  allowedRegions: [code],
                  lockedClasses: ["pii"],
                },
              });
            }}
          >
            <div>
              <Label htmlFor="rg-code">Code</Label>
              <Input id="rg-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="rg-name">Name</Label>
              <Input id="rg-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="rg-jur">Jurisdiction</Label>
              <Input
                id="rg-jur"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                required
              />
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="rg-url">Endpoint</Label>
              <Input
                id="rg-url"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-5">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Registering…" : "Register region"}
              </Button>
            </div>
          </form>
          {!organizationId ? (
            <div className="mt-2">
              <FormHint>
                Select an organization to also seed residency/routing policies on create.
              </FormHint>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="mb-6">
          <FormHint>Region registration requires super admin.</FormHint>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Regions
        </h2>
        {regions.isLoading ? (
          <p className="text-sm text-[var(--tc-muted)]">Loading regions…</p>
        ) : (
          <RegionTable regions={regions.data?.regions ?? []} />
        )}
      </section>

      <FailoverDialog
        open={failoverOpen}
        onClose={() => setFailoverOpen(false)}
        pending={failover.isPending}
        primaryHint={routing.data?.residency.homeRegionCode}
        standbyHint={
          regions.data?.regions.find((r) => r.code !== routing.data?.residency.homeRegionCode)
            ?.code
        }
        onFailover={(input) => {
          if (!organizationId) {
            setMessage("Select an organization before failover.");
            return;
          }
          failover.mutate(
            {
              organizationId,
              reason: input.reason,
              force: input.force,
              failoverPolicy: {
                mode: "manual",
                primaryRegionCode: input.primaryRegionCode,
                standbyRegions: input.standbyRegions,
              },
            },
            {
              onSuccess: (data) => {
                setMessage(
                  data.failover
                    ? `Failover ${data.failover.fromRegionCode} → ${data.failover.toRegionCode}`
                    : data.message ?? data.selection.reason,
                );
                setFailoverOpen(false);
              },
            },
          );
        }}
      />
    </AppShellLayout>
  );
}
