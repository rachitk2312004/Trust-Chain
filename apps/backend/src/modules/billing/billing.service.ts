import {
  BillingOwnerTypes,
  CommercialPlans,
  RoleKeys,
  type BillingOwnerType,
  type CommercialPlanKey,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import {
  activatePaidPlan,
  canPurchasePlan,
  effectivePlanKey,
  ensureOrgBillingAccount,
  ensureUserBillingAccount,
  getEntitlementSnapshot,
  maybeConsumeHolderVerification,
} from "./billing.entitlements.js";
import { publicPlanCatalog } from "./billing.plans.js";
import { verifyCertificateByPublicId } from "../certificates/certificates.public.js";
import {
  assertCapturedRazorpayPayment,
  createRazorpayOrder,
  razorpayKeyId,
  razorpayMockEnabled,
  verifyCheckoutSignature,
} from "./billing.razorpay.js";

function receiptFor(accountId: string): string {
  return `tc_${accountId.replace(/-/g, "").slice(0, 8)}_${Date.now().toString(36)}`.slice(0, 40);
}

export function listPublicPlans() {
  return {
    plans: publicPlanCatalog(),
    mockPayments: razorpayMockEnabled(),
    razorpayKeyId: razorpayKeyId(),
  };
}

export async function getBillingOverview(userId: string, organizationId?: string) {
  const user = await getEntitlementSnapshot({
    ownerType: BillingOwnerTypes.user,
    ownerId: userId,
  });
  let organization = null;
  if (organizationId) {
    const allowed = await userHasRole(
      userId,
      [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
      organizationId,
    );
    if (allowed) {
      organization = await getEntitlementSnapshot({
        ownerType: BillingOwnerTypes.organization,
        ownerId: organizationId,
      });
    }
  }
  const orders = await prisma.billingOrder.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      planKey: true,
      amountPaise: true,
      currency: true,
      status: true,
      razorpayOrderId: true,
      razorpayPaymentId: true,
      paidAt: true,
      createdAt: true,
      account: { select: { ownerType: true, organizationId: true } },
    },
  });
  return {
    ...listPublicPlans(),
    user,
    organization,
    orders: orders.map((row) => ({
      id: row.id,
      planKey: row.planKey,
      amountPaise: row.amountPaise,
      currency: row.currency,
      status: row.status,
      razorpayOrderId: row.razorpayOrderId,
      razorpayPaymentId: row.razorpayPaymentId,
      paidAt: row.paidAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      ownerType: row.account.ownerType,
      organizationId: row.account.organizationId,
    })),
  };
}

export async function createCheckout(
  userId: string,
  input: { planKey: CommercialPlanKey; ownerType: BillingOwnerType; organizationId?: string },
) {
  const plan = CommercialPlans[input.planKey];
  if (!plan || plan.monthlyAmountPaise <= 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Choose Premium Pro or Max Pro");
  }

  let account;
  if (input.ownerType === BillingOwnerTypes.organization) {
    if (!input.organizationId) {
      throw new AppError(400, "VALIDATION_ERROR", "organizationId is required for organization billing");
    }
    const allowed = await userHasRole(
      userId,
      [RoleKeys.superAdmin, RoleKeys.orgAdmin],
      input.organizationId,
    );
    if (!allowed) throw new AppError(403, "FORBIDDEN", "Organization admin role required");
    account = await ensureOrgBillingAccount(input.organizationId);
  } else {
    account = await ensureUserBillingAccount(userId);
  }

  const current = effectivePlanKey(account);
  if (!canPurchasePlan(current, input.planKey)) {
    throw new AppError(400, "PLAN_DOWNGRADE", "Choose an equal or higher plan");
  }

  const receipt = receiptFor(account.id);
  const razorpayOrder = await createRazorpayOrder({
    amountPaise: plan.monthlyAmountPaise,
    currency: plan.currency,
    receipt,
    notes: {
      accountId: account.id,
      planKey: input.planKey,
      ownerType: input.ownerType,
      userId,
    },
  });

  const order = await prisma.billingOrder.create({
    data: {
      accountId: account.id,
      createdById: userId,
      planKey: input.planKey,
      amountPaise: plan.monthlyAmountPaise,
      currency: plan.currency,
      status: "created",
      razorpayOrderId: razorpayOrder.id,
      receipt,
      notesJson: {
        ownerType: input.ownerType,
        organizationId: input.organizationId ?? null,
      },
    },
  });

  return {
    orderId: order.id,
    razorpayOrderId: razorpayOrder.id,
    amountPaise: plan.monthlyAmountPaise,
    currency: plan.currency,
    planKey: input.planKey,
    planName: plan.name,
    keyId: razorpayKeyId(),
    mock: razorpayMockEnabled(),
    name: "TrustChain",
    description: `${plan.name} · 30 days`,
  };
}

export async function confirmCheckoutPayment(
  userId: string,
  input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
) {
  const order = await prisma.billingOrder.findUnique({
    where: { razorpayOrderId: input.razorpayOrderId },
    include: { account: true },
  });
  if (!order || order.createdById !== userId) {
    throw new AppError(404, "BILLING_ORDER_NOT_FOUND", "Checkout order not found");
  }
  if (order.status === "paid") {
    return { ok: true, alreadyPaid: true, planKey: order.planKey };
  }

  const valid = verifyCheckoutSignature({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });
  if (!valid) {
    await prisma.billingOrder.update({
      where: { id: order.id },
      data: { status: "failed", razorpayPaymentId: input.razorpayPaymentId },
    });
    throw new AppError(400, "RAZORPAY_SIGNATURE_INVALID", "Payment signature did not match");
  }

  if (!razorpayMockEnabled()) {
    await assertCapturedRazorpayPayment({
      paymentId: input.razorpayPaymentId,
      orderId: input.razorpayOrderId,
      amountPaise: order.amountPaise,
    });
  }

  await fulfillPaidOrder({
    orderId: order.id,
    accountId: order.accountId,
    planKey: order.planKey as CommercialPlanKey,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });

  return { ok: true, alreadyPaid: false, planKey: order.planKey };
}

export async function fulfillPaidOrder(input: {
  orderId: string;
  accountId: string;
  planKey: CommercialPlanKey;
  paymentId: string;
  signature?: string | null;
}): Promise<void> {
  const existing = await prisma.billingOrder.findUnique({ where: { id: input.orderId } });
  if (!existing) return;
  if (existing.status === "paid") return;

  await prisma.billingOrder.update({
    where: { id: input.orderId },
    data: {
      status: "paid",
      razorpayPaymentId: input.paymentId,
      razorpaySignature: input.signature ?? existing.razorpaySignature,
      paidAt: new Date(),
    },
  });
  await activatePaidPlan({ accountId: input.accountId, planKey: input.planKey });
}

export async function fulfillPaidRazorpayOrder(razorpayOrderId: string, paymentId: string) {
  const order = await prisma.billingOrder.findUnique({
    where: { razorpayOrderId },
  });
  if (!order) return;
  await fulfillPaidOrder({
    orderId: order.id,
    accountId: order.accountId,
    planKey: order.planKey as CommercialPlanKey,
    paymentId,
  });
}

export async function markRazorpayOrderFailed(razorpayOrderId: string, paymentId?: string) {
  const order = await prisma.billingOrder.findUnique({
    where: { razorpayOrderId },
  });
  if (!order || order.status === "paid") return;
  await prisma.billingOrder.update({
    where: { id: order.id },
    data: {
      status: "failed",
      razorpayPaymentId: paymentId || order.razorpayPaymentId,
    },
  });
}

export async function verifyCertificateForHolder(
  userId: string,
  publicId: string,
  roleBindings?: Array<{ roleKey: string; organizationId: string | null }>,
) {
  const data = await verifyCertificateByPublicId(publicId);
  await maybeConsumeHolderVerification(userId, roleBindings);
  return data;
}
