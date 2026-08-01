import argon2 from "argon2";
import { AppError } from "../../lib/errors.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import { sendEmail } from "../../integrations/mailer.js";
import {
  createEmailToken,
  findValidEmailToken,
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
} from "./users.repository.js";
import { createMfaLoginChallenge, userHasMfaEnabled } from "./mfa.service.js";
import { issueSessionForUser } from "./session.service.js";
const EMAIL_VERIFY_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 1;

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function registerUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await createUser({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
  });

  await bindPublicUserRole(user.id);
  await issueEmailVerification(user.id, user.email);

  return toPublicUser(user);
}

export async function issueEmailVerification(userId: string, email: string): Promise<void> {
  await invalidateEmailTokens(userId, "email_verify");
  const token = generateOpaqueToken();
  await createEmailToken({
    userId,
    purpose: "email_verify",
    tokenHash: hashToken(token),
    expiresAt: hoursFromNow(EMAIL_VERIFY_TTL_HOURS),
  });

  await sendEmail({
    to: email,
    subject: "Verify your TrustChain email",
    text: `Your TrustChain email verification token is:\n\n${token}\n\nThis token expires in ${EMAIL_VERIFY_TTL_HOURS} hours.`,
  });
}

export async function resendEmailVerification(email: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user) {
    return;
  }
  if (user.email_verified_at) {
    throw new AppError(400, "EMAIL_ALREADY_VERIFIED", "Email is already verified");
  }
  await issueEmailVerification(user.id, user.email);
}

export async function verifyEmail(token: string) {
  const record = await findValidEmailToken(hashToken(token), "email_verify");
  if (!record) {
    throw new AppError(400, "INVALID_TOKEN", "Verification token is invalid or expired");
  }

  await markEmailTokenUsed(record.id);
  const user = await markEmailVerified(record.user_id);
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

  if (await userHasMfaEnabled(user.id)) {
    const mfaToken = await createMfaLoginChallenge(user.id);
    return {
      mfaRequired: true as const,
      mfaToken,
      user: toPublicUser(user),
      emailVerified: Boolean(user.email_verified_at),
    };
  }

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

  return toPublicUser(user);
}
