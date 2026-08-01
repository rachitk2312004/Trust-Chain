import { AppName } from "@trustchain/config";
import { authenticator } from "otplib";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { decryptSecret, encryptSecret } from "../../lib/secretBox.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import {
  createPendingMfaFactor,
  disableMfaFactorsForUser,
  findActiveMfaFactor,
  findPendingMfaFactor,
  markMfaFactorVerified,
  userHasMfaEnabled,
} from "./mfa.repository.js";
import { findUserById, type UserRow } from "./users.repository.js";
import { issueSessionForUser } from "./session.service.js";

authenticator.options = { window: 1 };

export async function setupMfa(user: UserRow) {
  if (await userHasMfaEnabled(user.id)) {
    throw new AppError(400, "MFA_ALREADY_ENABLED", "MFA is already enabled");
  }

  const secret = authenticator.generateSecret();
  await createPendingMfaFactor(user.id, encryptSecret(secret));
  const otpauthUrl = authenticator.keyuri(user.email, AppName, secret);

  return {
    secret,
    otpauthUrl,
  };
}

export async function enableMfa(user: UserRow, code: string) {
  const pending = await findPendingMfaFactor(user.id);
  if (!pending) {
    throw new AppError(400, "MFA_SETUP_REQUIRED", "Start MFA setup before enabling");
  }

  const secret = decryptSecret(pending.secret_encrypted);
  const valid = authenticator.verify({ token: code, secret });
  if (!valid) {
    throw new AppError(400, "INVALID_MFA_CODE", "Invalid MFA code");
  }

  await markMfaFactorVerified(pending.id);
  return { enabled: true as const };
}

export async function disableMfa(user: UserRow, code: string) {
  const active = await findActiveMfaFactor(user.id);
  if (!active) {
    throw new AppError(400, "MFA_NOT_ENABLED", "MFA is not enabled");
  }

  const secret = decryptSecret(active.secret_encrypted);
  const valid = authenticator.verify({ token: code, secret });
  if (!valid) {
    throw new AppError(400, "INVALID_MFA_CODE", "Invalid MFA code");
  }

  await disableMfaFactorsForUser(user.id);
  return { enabled: false as const };
}

export async function verifyTotpForUser(userId: string, code: string): Promise<boolean> {
  const active = await findActiveMfaFactor(userId);
  if (!active) {
    return false;
  }
  const secret = decryptSecret(active.secret_encrypted);
  return authenticator.verify({ token: code, secret });
}

export { userHasMfaEnabled };

export async function createMfaLoginChallenge(userId: string): Promise<string> {
  const token = generateOpaqueToken();
  await prisma.mfaLoginChallenge.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return token;
}

export async function consumeMfaLoginChallenge(token: string): Promise<string> {
  const row = await prisma.mfaLoginChallenge.findFirst({
    where: {
      tokenHash: hashToken(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!row) {
    throw new AppError(400, "INVALID_MFA_CHALLENGE", "MFA challenge is invalid or expired");
  }

  await prisma.mfaLoginChallenge.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return row.userId;
}

export async function completeMfaLogin(input: {
  challengeToken: string;
  code: string;
  ip?: string | null;
  userAgent?: string | null;
  deviceName?: string;
  fingerprint?: string;
}) {
  const userId = await consumeMfaLoginChallenge(input.challengeToken);
  const ok = await verifyTotpForUser(userId, input.code);
  if (!ok) {
    throw new AppError(401, "INVALID_MFA_CODE", "Invalid MFA code");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  return issueSessionForUser(user, {
    ip: input.ip,
    userAgent: input.userAgent,
    deviceName: input.deviceName,
    fingerprint: input.fingerprint,
  });
}
