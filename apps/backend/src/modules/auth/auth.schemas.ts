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

export const resendVerificationBodySchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().email(),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});
