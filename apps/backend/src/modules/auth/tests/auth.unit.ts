import { parseBody } from "../../../lib/validate.js";
import { generateNumericOtp } from "../../../lib/crypto.js";
import {
  FIREBASE_OTP_VERIFY_EMAIL_BODY,
  identityToolkitErrorToAppError,
} from "../../../integrations/firebaseAdmin.js";
import { emailMatchesSuperAdmin } from "../../../bootstrap/superAdmin.js";
import { verifyEmailOtpBodySchema } from "../auth.schemas.js";

export function testEmailOtpValidation(): void {
  const ok = parseBody(verifyEmailOtpBodySchema, { email: "user@example.com", otp: "123456" });
  if (ok.otp !== "123456") throw new Error("otp parse");
  let threw = false;
  try {
    parseBody(verifyEmailOtpBodySchema, { email: "user@example.com", otp: "12ab56" });
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("non-numeric OTP should be rejected");
  threw = false;
  try {
    parseBody(verifyEmailOtpBodySchema, { email: "user@example.com", otp: "12345" });
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("short OTP should be rejected");
}

export function testNumericOtpFormat(): void {
  const otp = generateNumericOtp(6);
  if (!/^\d{6}$/.test(otp)) throw new Error(`expected 6-digit OTP, got ${otp}`);
}

export function testFirebaseOtpEmailTemplateHasNoLink(): void {
  if (!FIREBASE_OTP_VERIFY_EMAIL_BODY.includes("%DISPLAY_NAME%")) {
    throw new Error("OTP template must use %DISPLAY_NAME%");
  }
  if (/%LINK%/i.test(FIREBASE_OTP_VERIFY_EMAIL_BODY)) {
    throw new Error("OTP template must not include %LINK%");
  }
}

export function testIdentityToolkitQuotaMapping(): void {
  const quota = identityToolkitErrorToAppError("TOO_MANY_ATTEMPTS_TRY_LATER");
  if (quota.statusCode !== 429) throw new Error("quota should be 429");
  if (quota.code !== "FIREBASE_EMAIL_RATE_LIMITED") throw new Error("quota code");
  const other = identityToolkitErrorToAppError("INVALID_ID_TOKEN");
  if (other.statusCode !== 502) throw new Error("other Identity Toolkit errors stay 502");
  if (other.code !== "FIREBASE_ERROR") throw new Error("other code");
}

export function testSuperAdminEmailMatch(): void {
  const prev = process.env.SUPER_ADMIN_EMAIL;
  try {
    process.env.SUPER_ADMIN_EMAIL = "Admin@Example.com";
    if (!emailMatchesSuperAdmin("admin@example.com")) throw new Error("case-insensitive match");
    if (emailMatchesSuperAdmin("other@example.com")) throw new Error("other email must not match");
    delete process.env.SUPER_ADMIN_EMAIL;
    if (emailMatchesSuperAdmin("admin@example.com")) throw new Error("unset SUPER_ADMIN_EMAIL must not match");
  } finally {
    if (prev === undefined) delete process.env.SUPER_ADMIN_EMAIL;
    else process.env.SUPER_ADMIN_EMAIL = prev;
  }
}
