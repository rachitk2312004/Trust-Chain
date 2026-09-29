import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@trustchain/ui";
import { useSessionStore } from "../../lib/sessionStore";
import { useFeedback } from "../../hooks/useFeedback";
import { billingApi } from "../../services/billingApi";
import type { CommercialPlanKey } from "../../types/api";
import { useBillingCheckout } from "./hooks";

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayFailure = {
  error?: {
    description?: string;
    reason?: string;
    metadata?: { order_id?: string; payment_id?: string };
  };
};

type RazorpayCheckout = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailure) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

async function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return;

  // Remove a previously blocked/failed script tag so retries can succeed after CSP fixes.
  const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay]");
  if (existing && !window.Razorpay) {
    existing.remove();
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "true";
    script.onload = () => {
      if (window.Razorpay) resolve();
      else reject(new Error("Razorpay Checkout loaded without window.Razorpay"));
    };
    script.onerror = () =>
      reject(
        new Error(
          "Could not load Razorpay Checkout. Check that checkout.razorpay.com is allowed by CSP, and disable ad blockers for this site.",
        ),
      );
    document.body.appendChild(script);
  });
}

export function CheckoutButton({
  planKey,
  ownerType,
  organizationId,
  label,
  featured,
}: {
  planKey: Exclude<CommercialPlanKey, "free">;
  ownerType: "user" | "organization";
  organizationId?: string;
  label: string;
  featured?: boolean;
}) {
  const checkout = useBillingCheckout();
  const feedback = useFeedback();
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const accessToken = useSessionStore((s) => s.accessToken);

  const pay = useCallback(async () => {
    if (!accessToken) {
      window.location.assign("/login?next=/billing");
      return;
    }
    try {
      const session = await checkout.mutateAsync({
        planKey,
        ownerType,
        organizationId,
      });
      if (session.mock) {
        const ok = window.confirm(
          `Simulate Razorpay payment for ${session.planName} (${Math.round(session.amountPaise / 100)} INR)?\n\nMock mode is on because RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing on the API.`,
        );
        if (!ok) return;
        await billingApi.confirm({
          razorpayOrderId: session.razorpayOrderId,
          razorpayPaymentId: `pay_mock_${Date.now()}`,
          razorpaySignature: "mock_ok",
        });
        await queryClient.invalidateQueries({ queryKey: ["billing"] });
        feedback.success(`${session.planName} is now active`);
        return;
      }
      if (!session.keyId) {
        feedback.error(
          new Error(
            "API created an order but did not return RAZORPAY_KEY_ID. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on Railway, then redeploy.",
          ),
          "Missing Razorpay key",
        );
        return;
      }
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay Checkout did not load");
      let settled = false;
      const razorpay = new window.Razorpay({
        key: session.keyId,
        amount: session.amountPaise,
        currency: session.currency,
        name: session.name,
        description: session.description,
        order_id: session.razorpayOrderId,
        prefill: {
          email: user?.email ?? "",
          name: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
        },
        notes: {
          planKey: session.planKey,
          orderId: session.orderId,
        },
        theme: { color: "#059669" },
        retry: { enabled: true, max_count: 1 },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            if (!settled) {
              feedback.info("Checkout closed", "No payment was captured.");
            }
          },
        },
        handler: async (response: RazorpaySuccess) => {
          settled = true;
          try {
            await billingApi.confirm({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            await queryClient.invalidateQueries({ queryKey: ["billing"] });
            feedback.success(`${session.planName} is now active`);
          } catch (error) {
            feedback.error(error, "Payment was captured but could not be confirmed");
          }
        },
      });
      razorpay.on("payment.failed", (response) => {
        settled = true;
        const reason = response.error?.description ?? response.error?.reason ?? "Payment failed";
        feedback.error(new Error(reason), "Payment failed");
      });
      razorpay.open();
    } catch (error) {
      feedback.error(error, "Could not start checkout");
    }
  }, [accessToken, checkout, feedback, organizationId, ownerType, planKey, queryClient, user]);

  return (
    <Button
      variant={featured ? "primary" : "secondary"}
      disabled={checkout.isPending}
      onClick={() => void pay()}
    >
      {checkout.isPending ? "Starting checkout…" : label}
    </Button>
  );
}
