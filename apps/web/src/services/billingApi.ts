import { apiClient } from "./http";
import type {
  BillingCheckout,
  BillingOverview,
  CommercialPlanKey,
} from "../types/api";

export const billingApi = {
  plans() {
    return apiClient.get<{
      plans: BillingOverview["plans"];
      mockPayments: boolean;
      razorpayKeyId: string | null;
    }>("/billing/plans");
  },
  entitlements(organizationId?: string | null) {
    return apiClient.get<BillingOverview>("/billing/entitlements", {
      params: organizationId ? { organizationId } : undefined,
    });
  },
  checkout(input: {
    planKey: Exclude<CommercialPlanKey, "free">;
    ownerType: "user" | "organization";
    organizationId?: string;
  }) {
    return apiClient.post<BillingCheckout>("/billing/checkout", input);
  },
  confirm(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    return apiClient.post<{ ok: boolean; alreadyPaid: boolean; planKey: string }>(
      "/billing/confirm",
      input,
    );
  },
  verifyCertificate(publicId: string) {
    return apiClient.post("/billing/verify-certificate", { publicId });
  },
};
