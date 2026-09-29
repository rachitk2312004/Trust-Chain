import axios, { type AxiosError } from "axios";
import { parseApiError } from "./apiErrors";
import type { ApiErrorBody, BillingFeatureKey } from "../types/api";

export function isPlanLockedError(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.code === "PLAN_REQUIRED" || parsed.code === "PLAN_QUOTA_EXCEEDED";
}

export function planLockDetails(error: unknown): {
  code?: string;
  feature?: BillingFeatureKey;
  requiredPlan?: string;
} {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return {};
  const ax = error as AxiosError<ApiErrorBody>;
  const details = ax.response?.data?.error?.details as
    | { feature?: BillingFeatureKey; requiredPlan?: string }
    | undefined;
  return {
    code: ax.response?.data?.error?.code,
    feature: details?.feature,
    requiredPlan: details?.requiredPlan,
  };
}

export function billingErrorMessage(error: unknown, fallback = "This action needs a paid plan."): string {
  const parsed = parseApiError(error);
  if (parsed.code === "PLAN_QUOTA_EXCEEDED") {
    return parsed.message || "This month’s allowance is used up. Upgrade to continue.";
  }
  if (parsed.code === "PLAN_REQUIRED") {
    return parsed.message || "Upgrade your plan to use this feature.";
  }
  return parsed.message || fallback;
}
