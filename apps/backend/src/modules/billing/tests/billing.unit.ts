import { BillingFeatureKeys, CommercialPlanKeys, CommercialPlans } from "@trustchain/config";
import { AppError } from "../../../lib/errors.js";
import { parseBody } from "../../../lib/validate.js";
import {
  addBillingPeriod,
  canPurchasePlan,
  currentPeriodYm,
  effectivePlanKey,
  formatInrFromPaise,
  isCommercialPlanKey,
  planRank,
  planRequiredError,
  quotaExceededError,
} from "../billing.plans.js";
import { hmacSha256Hex, razorpayMockEnabled, signaturesMatch, verifyCheckoutSignature, verifyWebhookSignature } from "../billing.razorpay.js";
import { checkoutBodySchema } from "../billing.schemas.js";

export function testBillingPlanCatalog(): void {
  if (!isCommercialPlanKey("premium_pro")) throw new Error("premium_pro should be a plan");
  if (isCommercialPlanKey("starter")) throw new Error("ops starter is not a commercial plan");
  if (planRank("max_pro") <= planRank("premium_pro")) throw new Error("max should outrank pro");
  if (CommercialPlans.free.quotas.holder_verifications !== 10) {
    throw new Error("free holder verification quota should be 10");
  }
  if (CommercialPlans.premium_pro.features.trust_reports) {
    throw new Error("Premium Pro should not include trust reports");
  }
  if (!CommercialPlans.max_pro.features.trust_reports) {
    throw new Error("Max Pro should include trust reports");
  }
  const price = formatInrFromPaise(249_900);
  if (!price.includes("2,499") && !price.includes("2499")) {
    throw new Error(`unexpected INR format: ${price}`);
  }
}

export function testBillingEntitlementRules(): void {
  const now = new Date("2026-09-09T00:00:00.000Z");
  if (effectivePlanKey({ planKey: "max_pro", status: "active", periodEnd: null }, now) !== "max_pro") {
    throw new Error("active paid plan without end date should stay paid");
  }
  if (
    effectivePlanKey(
      { planKey: "premium_pro", status: "active", periodEnd: new Date("2026-08-01T00:00:00.000Z") },
      now,
    ) !== "free"
  ) {
    throw new Error("expired paid plan should fall back to free");
  }
  if (!canPurchasePlan("free", "premium_pro")) throw new Error("holder should be able to buy Pro");
  if (canPurchasePlan("max_pro", "premium_pro")) throw new Error("should not allow downgrade");
  if (!canPurchasePlan("premium_pro", "premium_pro")) throw new Error("renewal of the same plan is allowed");

  const required = planRequiredError(BillingFeatureKeys.trustReports, CommercialPlanKeys.maxPro);
  if (!(required instanceof AppError) || required.code !== "PLAN_REQUIRED" || required.statusCode !== 402) {
    throw new Error("PLAN_REQUIRED should be HTTP 402");
  }
  const quota = quotaExceededError("holder_verifications", 10);
  if (quota.code !== "PLAN_QUOTA_EXCEEDED") throw new Error("quota error code");
  if (currentPeriodYm(now) !== "2026-09") throw new Error("period ym");
  const later = addBillingPeriod(now, 30);
  if (later.getTime() <= now.getTime()) throw new Error("billing period should extend");
}

export function testRazorpaySignatures(): void {
  const secret = "test_secret";
  const payload = "order_1|pay_1";
  const signature = hmacSha256Hex(payload, secret);
  if (!signaturesMatch(signature, hmacSha256Hex(payload, secret))) {
    throw new Error("matching signatures should pass");
  }
  if (signaturesMatch(signature, hmacSha256Hex("order_1|pay_2", secret))) {
    throw new Error("mismatched signatures should fail");
  }
  if (
    !verifyCheckoutSignature({
      orderId: "order_1",
      paymentId: "pay_1",
      signature,
      secret,
    })
  ) {
    throw new Error("checkout signature should verify");
  }
  const body = '{"event":"payment.captured"}';
  const hook = hmacSha256Hex(body, secret);
  if (!verifyWebhookSignature(body, hook, secret)) {
    throw new Error("webhook signature should verify");
  }
}

export function testRazorpayLiveKeysDisableMock(): void {
  const prev = {
    mock: process.env.RAZORPAY_MOCK,
    id: process.env.RAZORPAY_KEY_ID,
    secret: process.env.RAZORPAY_KEY_SECRET,
  };
  try {
    process.env.RAZORPAY_MOCK = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
    if (razorpayMockEnabled()) {
      throw new Error("Razorpay keys should disable mock checkout");
    }
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayMockEnabled()) {
      throw new Error("RAZORPAY_MOCK without keys should stay on mock checkout");
    }
  } finally {
    if (prev.mock === undefined) delete process.env.RAZORPAY_MOCK;
    else process.env.RAZORPAY_MOCK = prev.mock;
    if (prev.id === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = prev.id;
    if (prev.secret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = prev.secret;
  }
}

export function testBillingValidation(): void {
  const ok = parseBody(checkoutBodySchema, {
    planKey: "premium_pro",
    ownerType: "organization",
    organizationId: "11111111-1111-1111-1111-111111111111",
  });
  if (ok.planKey !== "premium_pro") throw new Error("checkout parse");
  let threw = false;
  try {
    parseBody(checkoutBodySchema, { planKey: "free", ownerType: "user" });
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("free plan checkout should be rejected");
}
