import {
  BillingFeatureKeys,
  BillingMetricKeys,
  BillingOwnerTypes,
  CommercialPlanKeys,
  CommercialPlans,
  RoleKeys,
  type BillingFeatureKey,
  type BillingMetricKey,
  type BillingOwnerType,
  type CommercialPlanKey,
} from "@trustchain/config";
import { prisma, Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import {
  addBillingPeriod,
  asPlanKey,
  currentPeriodYm,
  effectivePlanKey,
  isPaidPlan,
  planRank,
  planRequiredError,
  quotaExceededError,
} from "./billing.plans.js";
import { razorpayKeyId, razorpayMockEnabled } from "./billing.razorpay.js";

type BillingAccountRow = {
  id: string;
  ownerType: string;
  userId: string | null;
  organizationId: string | null;
  planKey: string;
  status: string;
  periodStart: Date | null;
  periodEnd: Date | null;
};

export type QuotaSnapshot = {
  used: number;
  limit: number | null;
  remaining: number | null;
};

export type EntitlementSnapshot = {
  ownerType: BillingOwnerType;
  ownerId: string;
  accountId: string;
  planKey: CommercialPlanKey;
  effectivePlanKey: CommercialPlanKey;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  features: Record<BillingFeatureKey, boolean>;
  quotas: Record<BillingMetricKey, QuotaSnapshot>;
  mockPayments: boolean;
  razorpayKeyId: string | null;
};

export { canPurchasePlan, effectivePlanKey, planRequiredError, quotaExceededError } from "./billing.plans.js";

export async function isSuperAdminUser(userId: string): Promise<boolean> {
  return userHasRole(userId, [RoleKeys.superAdmin]);
}

export async function ensureUserBillingAccount(userId: string): Promise<BillingAccountRow> {
  const existing = await prisma.billingAccount.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await prisma.billingAccount.create({
      data: {
        ownerType: BillingOwnerTypes.user,
        userId,
        planKey: CommercialPlanKeys.free,
        status: "active",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.billingAccount.findUnique({ where: { userId } });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function ensureOrgBillingAccount(organizationId: string): Promise<BillingAccountRow> {
  const existing = await prisma.billingAccount.findUnique({ where: { organizationId } });
  if (existing) return existing;
  try {
    return await prisma.billingAccount.create({
      data: {
        ownerType: BillingOwnerTypes.organization,
        organizationId,
        planKey: CommercialPlanKeys.free,
        status: "active",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.billingAccount.findUnique({ where: { organizationId } });
      if (raced) return raced;
    }
    throw error;
  }
}

async function usageMap(accountId: string): Promise<Record<string, number>> {
  const periodYm = currentPeriodYm();
  const rows = await prisma.billingUsage.findMany({
    where: { accountId, periodYm },
    select: { metricKey: true, usedCount: true },
  });
  return Object.fromEntries(rows.map((row) => [row.metricKey, row.usedCount]));
}

export async function getEntitlementSnapshot(input: {
  ownerType: BillingOwnerType;
  ownerId: string;
}): Promise<EntitlementSnapshot> {
  const account =
    input.ownerType === BillingOwnerTypes.user
      ? await ensureUserBillingAccount(input.ownerId)
      : await ensureOrgBillingAccount(input.ownerId);
  const used = await usageMap(account.id);
  const effective = effectivePlanKey(account);
  const plan = CommercialPlans[effective];
  const quotas = Object.fromEntries(
    (Object.values(BillingMetricKeys) as BillingMetricKey[]).map((metric) => {
      const limit = plan.quotas[metric];
      const usedCount = used[metric] ?? 0;
      return [
        metric,
        {
          used: usedCount,
          limit,
          remaining: limit === null ? null : Math.max(0, limit - usedCount),
        } satisfies QuotaSnapshot,
      ];
    }),
  ) as Record<BillingMetricKey, QuotaSnapshot>;

  return {
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    accountId: account.id,
    planKey: asPlanKey(account.planKey),
    effectivePlanKey: effective,
    status: account.status,
    periodStart: account.periodStart?.toISOString() ?? null,
    periodEnd: account.periodEnd?.toISOString() ?? null,
    features: plan.features,
    quotas,
    mockPayments: razorpayMockEnabled(),
    razorpayKeyId: razorpayKeyId(),
  };
}

function requiredPlanForFeature(feature: BillingFeatureKey): CommercialPlanKey {
  if (CommercialPlans.max_pro.features[feature] && !CommercialPlans.premium_pro.features[feature]) {
    return CommercialPlanKeys.maxPro;
  }
  if (CommercialPlans.premium_pro.features[feature]) return CommercialPlanKeys.premiumPro;
  return CommercialPlanKeys.free;
}

export async function assertOrgFeature(
  userId: string,
  organizationId: string,
  feature: BillingFeatureKey,
): Promise<EntitlementSnapshot> {
  if (await isSuperAdminUser(userId)) {
    return getEntitlementSnapshot({
      ownerType: BillingOwnerTypes.organization,
      ownerId: organizationId,
    });
  }
  const snapshot = await getEntitlementSnapshot({
    ownerType: BillingOwnerTypes.organization,
    ownerId: organizationId,
  });
  if (!snapshot.features[feature]) {
    throw planRequiredError(feature, requiredPlanForFeature(feature));
  }
  return snapshot;
}

export async function assertUserFeature(
  userId: string,
  feature: BillingFeatureKey,
): Promise<EntitlementSnapshot> {
  if (await isSuperAdminUser(userId)) {
    return getEntitlementSnapshot({ ownerType: BillingOwnerTypes.user, ownerId: userId });
  }
  const snapshot = await getEntitlementSnapshot({
    ownerType: BillingOwnerTypes.user,
    ownerId: userId,
  });
  if (!snapshot.features[feature]) {
    throw planRequiredError(feature, requiredPlanForFeature(feature));
  }
  return snapshot;
}

export async function consumeOrgMetric(
  userId: string,
  organizationId: string,
  metric: BillingMetricKey,
  amount: number,
  requiredFeature: BillingFeatureKey,
): Promise<void> {
  if (amount <= 0) return;
  if (await isSuperAdminUser(userId)) return;
  await assertOrgFeature(userId, organizationId, requiredFeature);
  const account = await ensureOrgBillingAccount(organizationId);
  await consumeMetric(account.id, effectivePlanKey(account), metric, amount);
}

export async function consumeUserMetric(
  userId: string,
  metric: BillingMetricKey,
  amount: number,
  requiredFeature: BillingFeatureKey,
): Promise<void> {
  if (amount <= 0) return;
  if (await isSuperAdminUser(userId)) return;
  await assertUserFeature(userId, requiredFeature);
  const account = await ensureUserBillingAccount(userId);
  await consumeMetric(account.id, effectivePlanKey(account), metric, amount);
}

async function consumeMetric(
  accountId: string,
  planKey: CommercialPlanKey,
  metric: BillingMetricKey,
  amount: number,
): Promise<void> {
  const limit = CommercialPlans[planKey].quotas[metric];
  if (limit === 0) {
    throw quotaExceededError(metric, 0);
  }
  const periodYm = currentPeriodYm();
  await prisma.billingUsage.upsert({
    where: {
      accountId_metricKey_periodYm: { accountId, metricKey: metric, periodYm },
    },
    create: { accountId, metricKey: metric, periodYm, usedCount: 0 },
    update: {},
  });

  if (limit === null) {
    await prisma.billingUsage.update({
      where: {
        accountId_metricKey_periodYm: { accountId, metricKey: metric, periodYm },
      },
      data: { usedCount: { increment: amount } },
    });
    return;
  }

  const updated = await prisma.$executeRaw`
    UPDATE billing_usage
    SET used_count = used_count + ${amount}, updated_at = NOW()
    WHERE account_id = ${accountId}::uuid
      AND metric_key = ${metric}
      AND period_ym = ${periodYm}
      AND used_count + ${amount} <= ${limit}
  `;
  if (updated === 0) {
    throw quotaExceededError(metric, limit);
  }
}

export async function activatePaidPlan(input: {
  accountId: string;
  planKey: CommercialPlanKey;
  paidAt?: Date;
}): Promise<void> {
  if (!isPaidPlan(input.planKey)) {
    throw new AppError(400, "VALIDATION_ERROR", "Cannot activate the free plan from a payment");
  }
  const now = input.paidAt ?? new Date();
  const account = await prisma.billingAccount.findUnique({ where: { id: input.accountId } });
  if (!account) throw new AppError(404, "BILLING_ACCOUNT_NOT_FOUND", "Billing account not found");

  const current = effectivePlanKey(account, now);
  if (planRank(input.planKey) < planRank(current)) {
    throw new AppError(400, "PLAN_DOWNGRADE", "Use a higher plan or wait for the current period to end");
  }

  const base =
    account.periodEnd && account.periodEnd.getTime() > now.getTime() && current === input.planKey
      ? account.periodEnd
      : now;

  await prisma.billingAccount.update({
    where: { id: input.accountId },
    data: {
      planKey: input.planKey,
      status: "active",
      periodStart: current === input.planKey && account.periodStart ? account.periodStart : now,
      periodEnd: addBillingPeriod(base),
    },
  });
}

export async function maybeConsumeHolderVerification(
  userId: string,
  roleBindings?: Array<{ roleKey: string; organizationId: string | null }>,
): Promise<void> {
  const staff = (roleBindings ?? []).some(
    (role) =>
      role.roleKey === RoleKeys.superAdmin ||
      ((role.roleKey === RoleKeys.orgAdmin || role.roleKey === RoleKeys.employee) && Boolean(role.organizationId)),
  );
  if (staff) return;
  await consumeUserMetric(
    userId,
    BillingMetricKeys.holderVerifications,
    1,
    BillingFeatureKeys.holderVerification,
  );
}
