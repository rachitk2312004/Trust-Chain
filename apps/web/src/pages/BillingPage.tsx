import { Link, useSearchParams } from "react-router-dom";
import { Badge, Card, CardDescription, CardHeader, CardTitle, FormError, FormHint, TD, TH } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { CheckoutButton } from "../features/billing/CheckoutButton";
import { useBillingEntitlements } from "../features/billing/hooks";
import { usePermissions } from "../hooks/usePermissions";
import { getApiErrorMessage } from "../lib/apiErrors";
import { useSessionStore } from "../lib/sessionStore";
import type { BillingEntitlement, BillingQuotaSnapshot, CommercialPlanKey } from "../types/api";

function quotaText(row: BillingQuotaSnapshot): string {
  if (row.limit === null) return `${row.used} used · unlimited`;
  return `${row.used} / ${row.limit} used`;
}

function PlanSummary({
  title,
  snapshot,
}: {
  title: string;
  snapshot: BillingEntitlement | null;
}) {
  if (!snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>No billing account for this workspace yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge tone={snapshot.effectivePlanKey === "free" ? "neutral" : "success"}>
            {snapshot.effectivePlanKey.replace("_", " ")}
          </Badge>
        </CardTitle>
        <CardDescription>
          {snapshot.periodEnd
            ? `Current period ends ${new Date(snapshot.periodEnd).toLocaleDateString()}`
            : "No paid period on file"}
        </CardDescription>
      </CardHeader>
      <dl className="grid gap-2 px-6 pb-5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-tc-muted">Holder verifications</dt>
          <dd>{quotaText(snapshot.quotas.holder_verifications)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-tc-muted">Org verifications</dt>
          <dd>{quotaText(snapshot.quotas.org_verifications)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-tc-muted">Certificates issued</dt>
          <dd>{quotaText(snapshot.quotas.certificate_issues)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-tc-muted">Bulk jobs</dt>
          <dd>{quotaText(snapshot.quotas.bulk_issues)}</dd>
        </div>
      </dl>
    </Card>
  );
}

export function BillingPage() {
  const [params] = useSearchParams();
  const activeOrganizationId = useSessionStore((s) => s.activeOrganizationId);
  const organizationId = params.get("organizationId") || activeOrganizationId;
  const { isOrgAdmin, showHolderFeatures } = usePermissions(organizationId);
  const billing = useBillingEntitlements(organizationId);

  const ownerType = isOrgAdmin ? "organization" : "user";
  const checkoutOrgId = ownerType === "organization" ? organizationId ?? undefined : undefined;

  return (
    <>
      <PageHeader
        title="Plans and billing"
        description="Free holders get 10 certificate verifications each month. Premium Pro unlocks issuance and the verification desk. Max Pro unlocks every feature."
        actions={
          <Link to="/pricing" className="text-sm text-[var(--tc-accent)] hover:underline">
            Public pricing
          </Link>
        }
      />
      {billing.isError ? <FormError>{getApiErrorMessage(billing.error)}</FormError> : null}
      {billing.data?.mockPayments ? (
        <FormError>
          Razorpay is in mock mode on the API. Orders stay “created” until you confirm the browser
          dialog. Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on Railway (and keep
          RAZORPAY_MOCK=false), then redeploy the backend.
        </FormError>
      ) : (
        <FormHint>
          Razorpay Checkout is live
          {billing.data?.razorpayKeyId
            ? ` (key ${billing.data.razorpayKeyId.slice(0, 12)}…)`
            : ""}. After a successful payment, Premium Pro / Max Pro unlocks for this organization
          automatically.
        </FormHint>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <PlanSummary title="Your holder plan" snapshot={billing.data?.user ?? null} />
        {isOrgAdmin ? (
          <PlanSummary title="Organization plan" snapshot={billing.data?.organization ?? null} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Organization billing</CardTitle>
              <CardDescription>
                Organization admins subscribe the workspace. Staff inherit those features.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {(billing.data?.plans ?? [])
          .filter((plan) => plan.key !== "free")
          .map((plan) => (
            <Card key={plan.key}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.tagline}</CardDescription>
                <p className="pt-2 font-display text-2xl font-bold">{plan.priceLabel}</p>
              </CardHeader>
              <ul className="space-y-1 px-6 text-sm text-tc-muted">
                {plan.highlights.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 p-6">
                {showHolderFeatures ? (
                  <CheckoutButton
                    planKey={plan.key as Exclude<CommercialPlanKey, "free">}
                    ownerType="user"
                    label={`Buy ${plan.name} for me`}
                  />
                ) : null}
                {isOrgAdmin && checkoutOrgId ? (
                  <CheckoutButton
                    planKey={plan.key as Exclude<CommercialPlanKey, "free">}
                    ownerType="organization"
                    organizationId={checkoutOrgId}
                    featured
                    label={`Buy ${plan.name} for org`}
                  />
                ) : null}
              </div>
            </Card>
          ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent payments</CardTitle>
          <CardDescription>Razorpay orders created from this account</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto px-2 pb-4">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <TH>Plan</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>When</TH>
              </tr>
            </thead>
            <tbody>
              {(billing.data?.orders ?? []).map((order) => (
                <tr key={order.id}>
                  <TD>{order.planKey.replace("_", " ")}</TD>
                  <TD>
                    ₹{(order.amountPaise / 100).toLocaleString("en-IN")} {order.currency}
                  </TD>
                  <TD>{order.status}</TD>
                  <TD>{new Date(order.createdAt).toLocaleString()}</TD>
                </tr>
              ))}
              {(billing.data?.orders ?? []).length === 0 ? (
                <tr>
                  <TD colSpan={4}>No payments yet.</TD>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
