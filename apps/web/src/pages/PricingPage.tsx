import { Link } from "react-router-dom";
import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Card, CardDescription, CardHeader, CardTitle, FormError } from "@trustchain/ui";
import { useBillingPlans } from "../features/billing/hooks";
import { useTheme } from "../lib/theme";
import { Moon, Sun } from "lucide-react";
import { useSessionStore } from "../lib/sessionStore";

function quotaLabel(limit: number | null): string {
  if (limit === null) return "Unlimited";
  if (limit === 0) return "Not included";
  return `${limit} / month`;
}

export function PricingPage() {
  const plans = useBillingPlans();
  const { resolved, toggle } = useTheme();
  const accessToken = useSessionStore((s) => s.accessToken);
  const catalog = plans.data?.plans ?? [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-tc-canvas text-tc-fg">
      <div className="pointer-events-none absolute inset-0 tc-grid-bg opacity-40" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </span>
          TrustChain
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="tc-focus inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-tc-border text-tc-muted hover:bg-tc-surface"
            aria-label="Toggle theme"
          >
            {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to={accessToken ? "/billing" : "/login"} className="rounded-xl px-3 py-2 text-sm font-medium text-tc-muted hover:text-tc-fg">
            {accessToken ? "Billing" : "Sign in"}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-8">
        <p className="inline-flex items-center gap-2 rounded-full border border-tc-border bg-tc-surface/80 px-3 py-1 text-xs font-medium text-tc-muted">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          {plans.data?.razorpayKeyId?.startsWith("rzp_test_")
            ? "Razorpay test checkout · INR"
            : plans.data?.mockPayments
              ? "Razorpay mock checkout · INR"
              : "Razorpay checkout · INR"}
        </p>
        <h1 className="mt-5 font-display text-4xl font-bold tracking-tight md:text-5xl">
          Free for holders. Paid for issuers.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-tc-muted">
          Certificate holders start on Free with 10 verifications each month. Organizations upgrade to
          Premium Pro for issuance and verification, or Max Pro for every TrustChain feature.
        </p>
        {plans.isError ? <FormError>Could not load plans.</FormError> : null}

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {catalog.map((plan) => {
            const featured = plan.key === "premium_pro";
            const paid = plan.key !== "free";
            return (
              <Card
                key={plan.key}
                className={featured ? "border-emerald-500/40 shadow-soft ring-1 ring-emerald-500/20" : ""}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {featured ? <Badge tone="success">Most teams</Badge> : null}
                  </div>
                  <CardDescription>{plan.tagline}</CardDescription>
                  <p className="pt-3 font-display text-3xl font-bold">{plan.priceLabel}</p>
                </CardHeader>
                <ul className="space-y-2 px-6 text-sm">
                  {plan.highlights.map((item) => (
                    <li key={item} className="flex gap-2 text-tc-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-4 grid gap-1 px-6 text-xs text-tc-muted">
                  <div className="flex justify-between">
                    <dt>Holder verifications</dt>
                    <dd>{quotaLabel(plan.quotas.holder_verifications)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Org verifications</dt>
                    <dd>{quotaLabel(plan.quotas.org_verifications)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Certificates issued</dt>
                    <dd>{quotaLabel(plan.quotas.certificate_issues)}</dd>
                  </div>
                </dl>
                <div className="p-6">
                  {paid ? (
                    <Link
                      to={accessToken ? "/billing" : "/login"}
                      className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
                        featured
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border border-tc-border hover:bg-tc-surface-2"
                      }`}
                    >
                      {accessToken ? `Upgrade to ${plan.name}` : `Sign in to buy ${plan.name}`}
                    </Link>
                  ) : (
                    <Link
                      to={accessToken ? "/verify" : "/register"}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-tc-border px-4 text-sm font-semibold hover:bg-tc-surface-2"
                    >
                      {accessToken ? "Open wallet" : "Create a free holder account"}
                    </Link>
                  )}
                  {paid ? (
                    <p className="mt-3 text-xs text-tc-muted">
                      Checkout uses Razorpay. Organization admins subscribe the workspace; holders can
                      raise their personal verification allowance on the billing page.
                    </p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
