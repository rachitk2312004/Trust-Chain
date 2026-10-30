import argon2 from "argon2";
import { AppError } from "../../lib/errors.js";
import { generateNumericOtp, hashToken } from "../../lib/crypto.js";
import {
  confirmFirebasePasswordReset,
  firebaseEmailIsVerified,
  lookupFirebaseUidByEmail,
  markFirebaseEmailVerified,
  sendFirebaseEmailOtp,
  updateFirebasePassword,
  upsertFirebaseUserWithPassword,
  verifyFirebaseEmailPassword,
} from "../../integrations/firebaseAdmin.js";
import {
  createEmailToken,
  findValidEmailToken,
  findValidEmailTokenForUser,
  invalidateEmailTokens,
  markEmailTokenUsed,
} from "./emailTokens.repository.js";
import { ensureSuperAdminRoleForUser } from "../../bootstrap/superAdmin.js";
import { bindPublicUserRole } from "./roles.repository.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  setFirebaseUid,
  toPublicUser,
  updatePasswordHash,
  updatePendingRegistration,
} from "./users.repository.js";
import { createMfaLoginChallenge, userHasMfaEnabled } from "./mfa.service.js";
import { issueSessionForUser } from "./session.service.js";

const EMAIL_OTP_TTL_MINUTES = 10;

export const EMAIL_OTP_EXPIRES_IN_SECONDS = EMAIL_OTP_TTL_MINUTES * 60;

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
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
  await ensureSuperAdminRoleForUser(user.id, user.email);
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
  let user = await findUserById(userId);
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  if (!user.firebase_uid) {
    const linked = await lookupFirebaseUidByEmail(user.email);
    if (linked) {
      try {
        user = await setFirebaseUid(user.id, linked);
      } catch {
        console.error("[auth] failed to persist firebase_uid on user", { userId: user.id });
        user = { ...user, firebase_uid: linked };
      }
    }
  }

  if (!user.firebase_uid) {
    console.error("[auth] cannot send email OTP: user has no firebase_uid", { userId: user.id });
    throw new AppError(
      503,
      "FIREBASE_UID_MISSING",
      "This account is not linked to Firebase Auth, so a verification email cannot be sent. Register again with this email.",
    );
  }

  const otp = generateNumericOtp(6);
  const restoreDisplayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || email.split("@")[0] || "TrustChain user";

  // Send first. Invalidating the previous OTP before Firebase accepts the mailer
  // request burns the code already in the inbox when sendOobCode is rate-limited.
  await sendFirebaseEmailOtp({
    uid: user.firebase_uid,
    email,
    otp,
    restoreDisplayName,
  });

  await invalidateEmailTokens(userId, "email_verify");
  await createEmailToken({
    userId,
    purpose: "email_verify",
    tokenHash: hashToken(otp),
    expiresAt: minutesFromNow(EMAIL_OTP_TTL_MINUTES),
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
    await ensureSuperAdminRoleForUser(verified.id, verified.email);
    const { claimCertificatesForUser } = await import("../certificates/certificates.claim.js");
    await claimCertificatesForUser(verified.id, verified.email);
    return toPublicUser(verified);
  }

  await markEmailTokenUsed(record.id);
  const verified = await markEmailVerified(record.user_id);
  await ensureSuperAdminRoleForUser(verified.id, verified.email);
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
  await ensureSuperAdminRoleForUser(user.id, user.email);
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

  let valid = await verifyPassword(user.password_hash, input.password);
  if (!valid) {
    // If the user reset via Firebase's hosted page, Postgres may lag — sync on successful Firebase auth.
    const firebaseOk = await verifyFirebaseEmailPassword(user.email, input.password);
    if (!firebaseOk) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }
    await updatePasswordHash(user.id, await hashPassword(input.password));
    valid = true;
  }

  await ensureSuperAdminRoleForUser(user.id, user.email);

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

export async function requestPasswordReset(email: string): Promise<{
  method: "otp";
  expiresInSeconds: number;
} | void> {
  let user = await findUserByEmail(email);
  // Always return quietly for unknown emails (no account enumeration).
  if (!user) {
    return { method: "otp", expiresInSeconds: EMAIL_OTP_EXPIRES_IN_SECONDS };
  }

  if (!user.firebase_uid) {
    const linked = await lookupFirebaseUidByEmail(user.email);
    if (linked) {
      try {
        user = await setFirebaseUid(user.id, linked);
      } catch {
        user = { ...user, firebase_uid: linked };
      }
    }
  }

  if (!user.firebase_uid) {
    throw new AppError(
      503,
      "FIREBASE_UID_MISSING",
      "This account is not linked to Firebase Auth, so a reset email cannot be sent.",
    );
  }

  // Same Firebase mailer path as email verification: 6-digit OTP in %DISPLAY_NAME%.
  // Do not use PASSWORD_RESET oob links (Firebase hosted UI, no OTP).
  const otp = generateNumericOtp(6);
  const restoreDisplayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.email.split("@")[0] ||
    "TrustChain user";

  await sendFirebaseEmailOtp({
    uid: user.firebase_uid,
    email: user.email,
    otp,
    restoreDisplayName,
    preserveEmailVerified: true,
  });

  await invalidateEmailTokens(user.id, "password_reset");
  await createEmailToken({
    userId: user.id,
    purpose: "password_reset",
    tokenHash: hashToken(otp),
    expiresAt: minutesFromNow(EMAIL_OTP_TTL_MINUTES),
  });

  return { method: "otp", expiresInSeconds: EMAIL_OTP_EXPIRES_IN_SECONDS };
}

export async function resetPassword(input: {
  password: string;
  email?: string;
  otp?: string;
  oobCode?: string;
  token?: string;
}) {
  const passwordHash = await hashPassword(input.password);

  // Preferred: email + 6-digit OTP from Firebase-delivered message.
  if (input.email?.trim() && input.otp?.trim()) {
    const user = await findUserByEmail(input.email.trim());
    if (!user) {
      throw new AppError(400, "INVALID_TOKEN", "Reset code is invalid or expired");
    }
    const record = await findValidEmailTokenForUser(
      user.id,
      hashToken(input.otp.trim()),
      "password_reset",
    );
    if (!record) {
      throw new AppError(400, "INVALID_TOKEN", "Reset code is invalid or expired");
    }

    await updatePasswordHash(user.id, passwordHash);
    await markEmailTokenUsed(record.id);
    await invalidateEmailTokens(user.id, "password_reset");
    if (user.firebase_uid) {
      await updateFirebasePassword(user.firebase_uid, input.password);
    } else {
      const linked = await lookupFirebaseUidByEmail(user.email);
      if (linked) {
        await setFirebaseUid(user.id, linked);
        await updateFirebasePassword(linked, input.password);
      }
    }
    return toPublicUser(user);
  }

  // Older Firebase password-reset link (oobCode).
  if (input.oobCode?.trim()) {
    const { email } = await confirmFirebasePasswordReset({
      oobCode: input.oobCode.trim(),
      newPassword: input.password,
    });
    const user = await findUserByEmail(email);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    await updatePasswordHash(user.id, passwordHash);
    await invalidateEmailTokens(user.id, "password_reset");
    return toPublicUser(user);
  }

  // Legacy opaque token.
  const legacyToken = input.token?.trim();
  if (!legacyToken) {
    throw new AppError(400, "INVALID_TOKEN", "Reset code is invalid or expired");
  }

  const record = await findValidEmailToken(hashToken(legacyToken), "password_reset");
  if (!record) {
    throw new AppError(400, "INVALID_TOKEN", "Password reset token is invalid or expired");
  }

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
