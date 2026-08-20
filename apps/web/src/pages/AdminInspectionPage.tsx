import { Link } from "react-router-dom";
import { Button, FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  FeatureInspector,
  InspectionPanel,
  QuotaInspector,
  useAdminInspection,
} from "../features/admin";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import type { AdminFeatureFlag } from "../types/api";

export function AdminInspectionPage() {
  const { isSuperAdmin } = usePermissions();
  const inspection = useAdminInspection(isSuperAdmin);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Admin inspection" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  const sections = inspection.data?.sections ?? [];
  const quotasSection = sections.find((s) => s.id === "quotas");
  const featuresSection = sections.find((s) => s.id === "features");
  const quotaData =
    quotasSection?.data && typeof quotasSection.data === "object"
      ? (quotasSection.data as {
          tenantsWithQuota?: number;
          overLimit?: number;
          samples?: Array<{
            organizationId: string;
            slug: string;
            overLimit: boolean;
            utilization: Array<{
              resource: string;
              used: number;
              limit: number;
              percent: number | null;
            }>;
          }>;
        })
      : null;
  const featureData =
    featuresSection?.data && typeof featuresSection.data === "object"
      ? (featuresSection.data as {
          active?: number;
          killed?: number;
          sample?: AdminFeatureFlag[];
        })
      : null;

  return (
    <AdminShellLayout>
      <PageHeader
        title="Admin inspection"
        description="Tenant, quota, feature, audit, and configuration overview."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void inspection.refetch()}>
              Refresh
            </Button>
            <Link to="/admin" className="text-sm text-[var(--tc-accent)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />
      {inspection.isError ? (
        <FormError>{getApiErrorMessage(inspection.error)}</FormError>
      ) : null}
      {inspection.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Running inspection…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <InspectionPanel
            sections={sections}
            generatedAt={inspection.data?.generatedAt}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <QuotaInspector
              samples={quotaData?.samples ?? []}
              tenantsWithQuota={quotaData?.tenantsWithQuota}
              overLimit={quotaData?.overLimit}
            />
            <FeatureInspector
              features={featureData?.sample ?? []}
              active={featureData?.active}
              killed={featureData?.killed}
            />
          </div>
        </div>
      )}
    </AdminShellLayout>
  );
}
