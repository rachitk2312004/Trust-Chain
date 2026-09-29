import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth, type UserRecord } from "firebase-admin/auth";
import { AppError, isAppError } from "../lib/errors.js";

type ServiceAccountFields = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function parseServiceAccount(): ServiceAccountFields | null {
  const json = env("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (json) {
    let parsed: {
      project_id?: string;
      client_email?: string;
      private_key?: string;
      projectId?: string;
      clientEmail?: string;
      privateKey?: string;
    };
    try {
      parsed = JSON.parse(json) as typeof parsed;
    } catch {
      throw new AppError(
        500,
        "FIREBASE_CONFIG_INVALID",
        "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON",
      );
    }
    const projectId = parsed.project_id ?? parsed.projectId ?? "";
    const clientEmail = parsed.client_email ?? parsed.clientEmail ?? "";
    const privateKey = normalizePrivateKey(parsed.private_key ?? parsed.privateKey ?? "");
    if (!projectId || !clientEmail || !privateKey) {
      throw new AppError(
        500,
        "FIREBASE_CONFIG_INVALID",
        "Firebase service account JSON is missing project_id, client_email, or private_key",
      );
    }
    return { projectId, clientEmail, privateKey };
  }

  const projectId = env("FIREBASE_PROJECT_ID");
  const clientEmail = env("FIREBASE_CLIENT_EMAIL");
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY ?? "");
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

export function firebaseConfigured(): boolean {
  return Boolean(env("FIREBASE_SERVICE_ACCOUNT_JSON")) ||
    Boolean(env("FIREBASE_PROJECT_ID") && env("FIREBASE_CLIENT_EMAIL") && (process.env.FIREBASE_PRIVATE_KEY ?? "").trim());
}

function firebaseErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return "";
}

function wrapFirebaseError(error: unknown, fallback: string): AppError {
  if (isAppError(error)) return error;
  const code = firebaseErrorCode(error);
  if (code === "auth/email-already-exists") {
    return new AppError(409, "EMAIL_IN_USE", "An account with this email already exists");
  }
  if (code === "auth/invalid-password" || code === "auth/weak-password") {
    return new AppError(400, "VALIDATION_ERROR", "Password does not meet Firebase requirements");
  }
  console.error("[firebase]", code || fallback, error);
  return new AppError(502, "FIREBASE_ERROR", fallback);
}

export function getFirebaseAuth(): Auth | null {
  if (!firebaseConfigured()) return null;
  const creds = parseServiceAccount();
  if (!creds) return null;
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: creds.projectId,
        clientEmail: creds.clientEmail,
        privateKey: creds.privateKey,
      }),
    });
  }
  return getAuth();
}

export function assertFirebaseReady(): Auth {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new AppError(
      503,
      "FIREBASE_NOT_CONFIGURED",
      "Firebase Auth is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }
  return auth;
}

function displayNameOf(input: { firstName?: string; lastName?: string; email: string }): string {
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return name || input.email.split("@")[0] || "TrustChain user";
}

export async function upsertFirebaseUserWithPassword(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ uid: string }> {
  const auth = assertFirebaseReady();
  const displayName = displayNameOf(input);
  try {
    let existing: UserRecord | null = null;
    try {
      existing = await auth.getUserByEmail(input.email);
    } catch (error) {
      if (firebaseErrorCode(error) !== "auth/user-not-found") {
        throw error;
      }
    }

    if (existing) {
      if (existing.emailVerified) {
        throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists");
      }
      await auth.updateUser(existing.uid, {
        password: input.password,
        displayName,
        disabled: false,
        emailVerified: false,
      });
      return { uid: existing.uid };
    }

    const created = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName,
      emailVerified: false,
      disabled: false,
    });
    return { uid: created.uid };
  } catch (error) {
    throw wrapFirebaseError(error, "Could not save the account in Firebase");
  }
}

export async function lookupFirebaseUidByEmail(email: string): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    const record = await auth.getUserByEmail(email);
    return record.uid;
  } catch (error) {
    if (firebaseErrorCode(error) === "auth/user-not-found") return null;
    console.error("[firebase] failed to lookup user by email");
    return null;
  }
}

export async function markFirebaseEmailVerified(uid: string): Promise<void> {
  if (!uid || !firebaseConfigured()) return;
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    await auth.updateUser(uid, { emailVerified: true, disabled: false });
  } catch (error) {
    console.error("[firebase] failed to mark email verified", error);
  }
}

export async function updateFirebasePassword(uid: string, password: string): Promise<void> {
  if (!uid || !firebaseConfigured()) return;
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    await auth.updateUser(uid, { password });
  } catch (error) {
    console.error("[firebase] failed to update password", error);
  }
}

export function firebaseWebApiKey(): string {
  const key = env("FIREBASE_WEB_API_KEY") || env("FIREBASE_API_KEY");
  if (!key) {
    throw new AppError(
      503,
      "FIREBASE_NOT_CONFIGURED",
      "Set FIREBASE_WEB_API_KEY (Firebase Console → Project settings → Web API key) so verification emails can be sent by Firebase.",
    );
  }
  return key;
}

/** OTP-only verify-email body. %DISPLAY_NAME% is temporarily set to the 6-digit code. Do not include %LINK%. */
export const FIREBASE_OTP_VERIFY_EMAIL_BODY = [
  "Hello,",
  "",
  "%DISPLAY_NAME%",
  "",
  "Enter this 6-digit code in TrustChain. It expires in 10 minutes.",
  "",
  "If you did not request this, you can ignore this email.",
].join("\n");

export const FIREBASE_OTP_VERIFY_EMAIL_SUBJECT = "Your TrustChain verification code";

let verifyEmailTemplateEnsured = false;

async function googleAccessToken(): Promise<string | null> {
  const app = getApps()[0];
  const credential = app?.options.credential;
  if (!credential || typeof credential.getAccessToken !== "function") return null;
  const result = await credential.getAccessToken();
  return result?.access_token?.trim() || null;
}

/**
 * Firebase Console default template inserts %LINK% (the long verify URL).
 * Identity Toolkit admin config can replace it with an OTP-only body.
 * If this API is unavailable, set the same body in Authentication → Templates.
 */
async function ensureOtpOnlyVerifyEmailTemplate(): Promise<void> {
  if (verifyEmailTemplateEnsured) return;
  const creds = parseServiceAccount();
  const token = await googleAccessToken();
  if (!creds || !token) return;

  const url = new URL(`https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(creds.projectId)}/config`);
  url.searchParams.set("updateMask", "notification.sendEmail.verifyEmailTemplate");

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notification: {
        sendEmail: {
          verifyEmailTemplate: {
            senderDisplayName: "TrustChain",
            subject: FIREBASE_OTP_VERIFY_EMAIL_SUBJECT,
            body: FIREBASE_OTP_VERIFY_EMAIL_BODY,
            bodyFormat: "PLAIN_TEXT",
            customized: true,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    const snippet = message.replace(/\s+/g, " ").slice(0, 180);
    console.error("[firebase] could not set OTP-only verify-email template", {
      httpStatus: response.status,
      hint: snippet || "Edit Firebase Console → Authentication → Templates → Email address verification. Body must be OTP via %DISPLAY_NAME% with no %LINK%.",
    });
    return;
  }
  verifyEmailTemplateEnsured = true;
}

type IdentityToolkitError = {
  error?: { message?: string; status?: string };
  idToken?: string;
  email?: string;
};

const FIREBASE_EMAIL_QUOTA_CODES = [
  "TOO_MANY_ATTEMPTS_TRY_LATER",
  "RESET_PASSWORD_EXCEED_LIMIT",
  "QUOTA_EXCEEDED",
] as const;

/** Map Identity Toolkit error.message (e.g. TOO_MANY_ATTEMPTS_TRY_LATER) to an AppError. Never pass tokens or keys. */
export function identityToolkitErrorToAppError(message: string): AppError {
  const raw = message.trim() || "Firebase Auth request failed";
  const normalized = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (FIREBASE_EMAIL_QUOTA_CODES.some((code) => normalized.includes(code))) {
    return new AppError(
      429,
      "FIREBASE_EMAIL_RATE_LIMITED",
      "Firebase already sent a verification email. Wait a few minutes, use the 6-digit code from that message, then try resend again.",
      { firebaseCode: FIREBASE_EMAIL_QUOTA_CODES.find((code) => normalized.includes(code)) },
    );
  }
  return new AppError(502, "FIREBASE_ERROR", raw.replace(/_/g, " ").toLowerCase(), {
    firebaseCode: normalized.slice(0, 80),
  });
}

async function identityToolkitPost(path: string, payload: Record<string, unknown>): Promise<IdentityToolkitError> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(firebaseWebApiKey())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as IdentityToolkitError;
  if (!response.ok) {
    const message = body.error?.message ?? body.error?.status ?? "Firebase Auth request failed";
    console.error("[firebase] Identity Toolkit request failed", {
      path,
      httpStatus: response.status,
      firebaseCode: message,
    });
    throw identityToolkitErrorToAppError(message);
  }
  return body;
}

async function idTokenForUid(uid: string): Promise<string> {
  const auth = assertFirebaseReady();
  const customToken = await auth.createCustomToken(uid);
  const exchanged = await identityToolkitPost("accounts:signInWithCustomToken", {
    token: customToken,
    returnSecureToken: true,
  });
  if (!exchanged.idToken) {
    throw new AppError(502, "FIREBASE_ERROR", "Could not start Firebase email verification");
  }
  return exchanged.idToken;
}

/**
 * Sends a 6-digit OTP using Firebase Authentication's own mailer (Google delivers the
 * email — no Railway SMTP). Firebase templates have no OTP field, so the code is placed
 * in %DISPLAY_NAME% for the duration of sendOobCode, then restored.
 *
 * Do not pass continueUrl: that appended the TrustChain register URL (and OTP) onto the
 * default %LINK%. Verification is the 6-digit code in the app, not the email link.
 */
export async function sendFirebaseEmailOtp(input: {
  uid: string;
  email: string;
  otp: string;
  restoreDisplayName: string;
}): Promise<void> {
  const auth = assertFirebaseReady();
  firebaseWebApiKey();
  await ensureOtpOnlyVerifyEmailTemplate();

  await auth.updateUser(input.uid, { displayName: input.otp, emailVerified: false, disabled: false });
  try {
    const idToken = await idTokenForUid(input.uid);
    await identityToolkitPost("accounts:sendOobCode", {
      requestType: "VERIFY_EMAIL",
      idToken,
    });
  } finally {
    await auth.updateUser(input.uid, { displayName: input.restoreDisplayName }).catch((error) => {
      console.error("[firebase] failed to restore display name after OTP email", error);
    });
  }
}

export async function firebaseEmailIsVerified(email: string): Promise<boolean> {
  if (!firebaseConfigured()) return false;
  const auth = getFirebaseAuth();
  if (!auth) return false;
  try {
    const record = await auth.getUserByEmail(email);
    return Boolean(record.emailVerified);
  } catch (error) {
    if (firebaseErrorCode(error) === "auth/user-not-found") return false;
    console.error("[firebase] failed to read emailVerified", error);
    return false;
  }
}
