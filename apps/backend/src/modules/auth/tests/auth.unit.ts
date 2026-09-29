import { parseBody } from "../../../lib/validate.js";
import { generateNumericOtp } from "../../../lib/crypto.js";
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
