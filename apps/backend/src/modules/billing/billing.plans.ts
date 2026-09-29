import {
  BillingFeatureKeys,
  BillingMetricKeys,
  BillingPeriodDays,
  CommercialPlanKeys,
  CommercialPlans,
  type BillingFeatureKey,
  type BillingMetricKey,
  type BillingQuotaValue,
  type CommercialPlanKey,
} from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export {
  BillingFeatureKeys,
  BillingMetricKeys,
  BillingPeriodDays,
  CommercialPlanKeys,
  CommercialPlans,
};

export type { BillingFeatureKey, BillingMetricKey, BillingQuotaValue, CommercialPlanKey };

export function isCommercialPlanKey(value: string): value is CommercialPlanKey {
  return value === CommercialPlanKeys.free
    || value === CommercialPlanKeys.premiumPro
    || value === CommercialPlanKeys.maxPro;
}

export function planRank(planKey: CommercialPlanKey): number {
  return CommercialPlans[planKey].rank;
}

export function formatInrFromPaise(amountPaise: number): string {
  const rupees = amountPaise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function currentPeriodYm(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addBillingPeriod(from: Date, days = BillingPeriodDays): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isPaidPlan(planKey: CommercialPlanKey): boolean {
  return planKey !== CommercialPlanKeys.free;
}

export function asPlanKey(value: string): CommercialPlanKey {
  return isCommercialPlanKey(value) ? value : CommercialPlanKeys.free;
}

export function effectivePlanKey(account: {
  planKey: string;
  status: string;
  periodEnd: Date | null;
}, now = new Date()): CommercialPlanKey {
  const key = asPlanKey(account.planKey);
  if (!isPaidPlan(key)) return CommercialPlanKeys.free;
  if (account.status !== "active") return CommercialPlanKeys.free;
  if (account.periodEnd && account.periodEnd.getTime() < now.getTime()) {
    return CommercialPlanKeys.free;
  }
  return key;
}

export function canPurchasePlan(current: CommercialPlanKey, next: CommercialPlanKey): boolean {
  if (!isPaidPlan(next)) return false;
  // Strict upgrade only: Premium Pro active → Max Pro only; Max Pro → no further purchase.
  return planRank(next) > planRank(current);
}

export function planRequiredError(feature: BillingFeatureKey, requiredPlan: CommercialPlanKey): AppError {
  const plan = CommercialPlans[requiredPlan];
  return new AppError(
    402,
    "PLAN_REQUIRED",
    `${plan.name} is required for this action.`,
    { feature, requiredPlan },
  );
}

export function quotaExceededError(metric: BillingMetricKey, limit: number): AppError {
  return new AppError(
    402,
    "PLAN_QUOTA_EXCEEDED",
    "This month’s allowance is used up. Upgrade your plan to continue.",
    { metric, limit },
  );
}

export function publicPlanCatalog() {
  return CommercialPlanListSafe();
}

function CommercialPlanListSafe() {
  return Object.values(CommercialPlans).map((plan) => ({
    key: plan.key,
    name: plan.name,
    audience: plan.audience,
    tagline: plan.tagline,
    monthlyAmountPaise: plan.monthlyAmountPaise,
    currency: plan.currency,
    rank: plan.rank,
    features: plan.features,
    quotas: plan.quotas,
    highlights: plan.highlights,
    priceLabel:
      plan.monthlyAmountPaise === 0 ? "Free" : `${formatInrFromPaise(plan.monthlyAmountPaise)} / month`,
  }));
}
