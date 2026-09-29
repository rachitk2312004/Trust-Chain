import { z } from "zod";
import { CommercialPlanKeys } from "@trustchain/config";

export const checkoutBodySchema = z.object({
  planKey: z.enum([CommercialPlanKeys.premiumPro, CommercialPlanKeys.maxPro]),
  ownerType: z.enum(["user", "organization"]),
  organizationId: z.string().uuid().optional(),
});

export const confirmPaymentBodySchema = z.object({
  razorpayOrderId: z.string().min(6).max(80),
  razorpayPaymentId: z.string().min(6).max(80),
  razorpaySignature: z.string().min(8).max(256),
});

export const holderVerifyBodySchema = z.object({
  publicId: z.string().min(4).max(120),
});

export const entitlementsQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
});
