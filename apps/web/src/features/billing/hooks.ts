import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../../services/billingApi";
import type { CommercialPlanKey } from "../../types/api";

export const billingKeys = {
  plans: ["billing", "plans"] as const,
  entitlements: (organizationId?: string | null) =>
    ["billing", "entitlements", organizationId ?? "none"] as const,
};

export function useBillingPlans() {
  return useQuery({
    queryKey: billingKeys.plans,
    queryFn: async () => {
      const { data } = await billingApi.plans();
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useBillingEntitlements(organizationId?: string | null) {
  return useQuery({
    queryKey: billingKeys.entitlements(organizationId),
    queryFn: async () => {
      const { data } = await billingApi.entitlements(organizationId);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useBillingCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      planKey: Exclude<CommercialPlanKey, "free">;
      ownerType: "user" | "organization";
      organizationId?: string;
    }) => {
      const { data } = await billingApi.checkout(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useBillingConfirm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => {
      const { data } = await billingApi.confirm(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}
