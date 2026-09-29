import argon2 from "argon2";
import { AppError } from "../../lib/errors.js";
import { generateNumericOtp, generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import { sendEmail } from "../../integrations/mailer.js";
import {
  firebaseEmailIsVerified,
  markFirebaseEmailVerified,
  sendFirebaseEmailOtp,
  updateFirebasePassword,
  upsertFirebaseUserWithPassword,
} from "../../integrations/firebaseAdmin.js";
import {
  createEmailToken,
  findValidEmailToken,
  findValidEmailTokenForUser,
  invalidateEmailTokens,
  markEmailTokenUsed,
} from "./emailTokens.repository.js";
import { bindPublicUserRole } from "./roles.repository.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  toPublicUser,
  updatePasswordHash,
  updatePendingRegistration,
} from "./users.repository.js";
import { createMfaLoginChallenge, userHasMfaEnabled } from "./mfa.service.js";
import { issueSessionForUser } from "./session.service.js";

const EMAIL_OTP_TTL_MINUTES = 10;
const PASSWORD_RESET_TTL_HOURS = 1;

export const EMAIL_OTP_EXPIRES_IN_SECONDS = EMAIL_OTP_TTL_MINUTES * 60;

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function registerUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}) {
  const existing = await findUserByEmail(input.email);
  if (existing && (existing.email_verified_at || existing.status !== "pending")) {
    throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const firebase = await upsertFirebaseUserWithPassword({
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
  });

  const user = existing
    ? await updatePendingRegistration(existing.id, {
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        firebaseUid: firebase.uid,
      })
    : await createUser({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        firebaseUid: firebase.uid,
      });

  await bindPublicUserRole(user.id);
  await issueEmailOtp(user.id, user.email);
  const { claimCertificatesForUser } = await import("../certificates/certificates.claim.js");
  await claimCertificatesForUser(user.id, user.email);

  return {
    user: toPublicUser(user),
    verification: {
      method: "otp" as const,
      expiresInSeconds: EMAIL_OTP_EXPIRES_IN_SECONDS,
    },
  };
}

export async function issueEmailOtp(userId: string, email: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user?.firebase_uid) {
    throw new AppError(
      503,
      "FIREBASE_NOT_CONFIGURED",
      "Firebase Auth is required to email the verification code",
    );
  }

  await invalidateEmailTokens(userId, "email_verify");
  const otp = generateNumericOtp(6);
  await createEmailToken({
    userId,
    purpose: "email_verify",
    tokenHash: hashToken(otp),
    expiresAt: minutesFromNow(EMAIL_OTP_TTL_MINUTES),
  });

  const restoreDisplayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || email.split("@")[0] || "TrustChain user";

  await sendFirebaseEmailOtp({
    uid: user.firebase_uid,
    email,
    otp,
    restoreDisplayName,
  });
}

/** @deprecated Opaque-token verification remains for previously issued emails. New sign-ups use OTP. */
export async function issueEmailVerification(userId: string, email: string): Promise<void> {
  await issueEmailOtp(userId, email);
}

export async function resendEmailVerification(email: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user) {
    return;
  }
  if (user.email_verified_at) {
    throw new AppError(400, "EMAIL_ALREADY_VERIFIED", "Email is already verified");
  }
  await issueEmailOtp(user.id, user.email);
}

export async function verifyEmailOtp(input: { email: string; otp: string }) {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new AppError(400, "INVALID_TOKEN", "Verification code is invalid or expired");
  }

  const record = await findValidEmailTokenForUser(user.id, hashToken(input.otp.trim()), "email_verify");
  if (!record) {
    const firebaseVerified = await firebaseEmailIsVerified(user.email);
    if (!firebaseVerified) {
      throw new AppError(400, "INVALID_TOKEN", "Verification code is invalid or expired");
    }
    const verified = await markEmailVerified(user.id);
    const { claimCertificatesForUser } = await import("../certificates/certificates.claim.js");
    await claimCertificatesForUser(verified.id, verified.email);
    return toPublicUser(verified);
  }

  await markEmailTokenUsed(record.id);
  const verified = await markEmailVerified(record.user_id);
  if (verified.firebase_uid) {
    await markFirebaseEmailVerified(verified.firebase_uid);
  }
  const { claimCertificatesForUser } = await import("../certificates/certificates.claim.js");
  await claimCertificatesForUser(verified.id, verified.email);
  return toPublicUser(verified);
}

export async function verifyEmail(token: string) {
  if (/^\d{6}$/.test(token.trim())) {
    throw new AppError(
      400,
      "OTP_EMAIL_REQUIRED",
      "Submit email and the 6-digit code to /auth/email/verify-otp",
    );
  }

  const record = await findValidEmailToken(hashToken(token), "email_verify");
  if (!record) {
    throw new AppError(400, "INVALID_TOKEN", "Verification token is invalid or expired");
  }

  await markEmailTokenUsed(record.id);
  const user = await markEmailVerified(record.user_id);
  if (user.firebase_uid) {
    await markFirebaseEmailVerified(user.firebase_uid);
  }
  const { claimCertificatesForUser } = await import("../certificates/certificates.claim.js");
  await claimCertificatesForUser(user.id, user.email);
  return toPublicUser(user);
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
  deviceName?: string;
  fingerprint?: string;
}) {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const valid = await verifyPassword(user.password_hash, input.password);
  if (!valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (user.status === "disabled") {
    throw new AppError(403, "ACCOUNT_DISABLED", "Account is disabled");
  }

  if (user.status === "pending") {
    throw new AppError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Verify your email with the OTP we sent before signing in",
    );
  }

  if (await userHasMfaEnabled(user.id)) {
    const mfaToken = await createMfaLoginChallenge(user.id);
    return {
      mfaRequired: true as const,
      mfaToken,
      user: toPublicUser(user),
      emailVerified: Boolean(user.email_verified_at),
    };
  }

  const { claimCertificatesForUser } = await import("../certificates/certificates.claim.js");
  await claimCertificatesForUser(user.id, user.email);

  const session = await issueSessionForUser(user, {
    ip: input.ip,
    userAgent: input.userAgent,
    deviceName: input.deviceName,
    fingerprint: input.fingerprint,
  });

  return {
    mfaRequired: false as const,
    ...session,
    emailVerified: Boolean(user.email_verified_at),
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user) {
    return;
  }

  await invalidateEmailTokens(user.id, "password_reset");
  const token = generateOpaqueToken();
  await createEmailToken({
    userId: user.id,
    purpose: "password_reset",
    tokenHash: hashToken(token),
    expiresAt: hoursFromNow(PASSWORD_RESET_TTL_HOURS),
  });

  await sendEmail({
    to: user.email,
    subject: "Reset your TrustChain password",
    text: `Your TrustChain password reset token is:\n\n${token}\n\nThis token expires in ${PASSWORD_RESET_TTL_HOURS} hour(s).`,
  });
}

export async function resetPassword(input: { token: string; password: string }) {
  const record = await findValidEmailToken(hashToken(input.token), "password_reset");
  if (!record) {
    throw new AppError(400, "INVALID_TOKEN", "Password reset token is invalid or expired");
  }

  const passwordHash = await hashPassword(input.password);
  await updatePasswordHash(record.user_id, passwordHash);
  await markEmailTokenUsed(record.id);
  await invalidateEmailTokens(record.user_id, "password_reset");

  const user = await findUserById(record.user_id);
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }
  if (user.firebase_uid) {
    await updateFirebasePassword(user.firebase_uid, input.password);
  }

  return toPublicUser(user);
}
