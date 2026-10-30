import { z } from "zod";

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  deviceName: z.string().min(1).max(120).optional(),
  fingerprint: z.string().min(1).max(255).optional(),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export const mfaCodeBodySchema = z.object({
  code: z.string().min(6).max(8),
});

export const mfaVerifyLoginBodySchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(6).max(8),
  deviceName: z.string().min(1).max(120).optional(),
  fingerprint: z.string().min(1).max(255).optional(),
});

export const emailTokenBodySchema = z.object({
  token: z.string().min(1),
});

export const verifyEmailOtpBodySchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const resendVerificationBodySchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().email(),
});

export const resetPasswordBodySchema = z
  .object({
    password: z.string().min(8).max(128),
    /** Email + 6-digit OTP from the Firebase-delivered reset message. */
    email: z.string().email().optional(),
    otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits").optional(),
    /** Firebase Auth oobCode from an older password-reset link. */
    oobCode: z.string().min(1).optional(),
    /** Legacy opaque token. */
    token: z.string().min(1).optional(),
  })
  .refine(
    (value) =>
      Boolean(
        (value.email?.trim() && value.otp?.trim()) ||
          value.oobCode?.trim() ||
          value.token?.trim(),
      ),
    {
      message: "Email and OTP, or a reset code, is required",
      path: ["otp"],
    },
  );
