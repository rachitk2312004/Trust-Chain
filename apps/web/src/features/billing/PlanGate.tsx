import { Link } from "react-router-dom";
import { Button, Card, CardDescription, CardHeader, CardTitle } from "@trustchain/ui";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { BillingFeatureKey, BillingEntitlement } from "../../types/api";
import { useBillingEntitlements } from "./hooks";
import { useSessionStore } from "../../lib/sessionStore";

const FEATURE_COPY: Partial<Record<BillingFeatureKey, { title: string; plan: string }>> = {
  issue_certificates: { title: "Certificate issuance", plan: "Premium Pro" },
  certificate_templates: { title: "Certificate templates", plan: "Premium Pro" },
  bulk_issue: { title: "Bulk issue", plan: "Premium Pro" },
  org_verification: { title: "Organization verification", plan: "Premium Pro" },
  messaging: { title: "Team messaging", plan: "Premium Pro" },
  reports_export: { title: "Reports", plan: "Premium Pro" },
  trust_reports: { title: "Trust reports", plan: "Max Pro" },
  custom_branding: { title: "Custom branding", plan: "Max Pro" },
  chain_publish: { title: "On-chain publish", plan: "Max Pro" },
  analytics: { title: "Analytics", plan: "Max Pro" },
  developer_api: { title: "Developer API", plan: "Max Pro" },
  holder_verification: { title: "Certificate verification", plan: "Premium Pro" },
};

export function billingHref(organizationId?: string | null): string {
  return organizationId ? `/billing?organizationId=${organizationId}` : "/billing";
}

export function hasBillingFeature(
  snapshot: BillingEntitlement | null | undefined,
  feature: BillingFeatureKey,
): boolean {
  return Boolean(snapshot?.features[feature]);
}

export function UpgradeCard({
  feature,
  organizationId,
}: {
  feature: BillingFeatureKey;
  organizationId?: string | null;
}) {
  const copy = FEATURE_COPY[feature] ?? { title: "This feature", plan: "a paid plan" };
  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          {copy.title} is on {copy.plan}
        </CardTitle>
        <CardDescription>
          Upgrade to unlock this capability. Your current workspace stays on its existing plan until
          payment is confirmed.
        </CardDescription>
      </CardHeader>
      <div className="px-6 pb-5">
        <Link to={billingHref(organizationId)}>
          <Button>View plans</Button>
        </Link>
      </div>
    </Card>
  );
}

export function PlanLockedHint({
  feature,
}: {
  feature: BillingFeatureKey;
}) {
  const copy = FEATURE_COPY[feature] ?? { title: "This feature", plan: "a paid plan" };
  return (
    <p className="text-sm text-[var(--tc-muted)]">
      {copy.title} is not included in your plan.
    </p>
  );
}

export function PlanGate({
  feature,
  organizationId,
  children,
  /** `upgrade` shows billing CTA; `hint` is a plain “not included” line; `hide` renders nothing. */
  lockedFallback = "upgrade",
}: {
  feature: BillingFeatureKey;
  organizationId?: string | null;
  children: ReactNode;
  lockedFallback?: "upgrade" | "hint" | "hide";
}) {
  const activeOrganizationId = useSessionStore((s) => s.activeOrganizationId);
  const orgId = organizationId === undefined ? activeOrganizationId : organizationId;
  const billing = useBillingEntitlements(orgId);
  const snapshot = orgId ? billing.data?.organization : billing.data?.user;
  if (billing.isLoading) return <>{children}</>;
  if (snapshot && !hasBillingFeature(snapshot, feature)) {
    if (lockedFallback === "hide") return null;
    if (lockedFallback === "hint") return <PlanLockedHint feature={feature} />;
    return <UpgradeCard feature={feature} organizationId={orgId} />;
  }
  return <>{children}</>;
}
