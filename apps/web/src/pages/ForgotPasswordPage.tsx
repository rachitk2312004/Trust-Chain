import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Field, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { useForgotPassword, useResetPassword } from "../features/auth/hooks";
import { getApiErrorMessage, isRateLimited, parseApiError } from "../lib/apiErrors";
import { AuthLayout } from "../layouts/AuthLayout";
import { Card } from "../components/ui";

function isFirebaseEmailRateLimited(error: unknown): boolean {
  return parseApiError(error).code === "FIREBASE_EMAIL_RATE_LIMITED";
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const forgot = useForgotPassword();
  const reset = useResetPassword();

  const step = params.get("step") === "otp" ? "otp" : "email";
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [rateLimitHint, setRateLimitHint] = useState<string | null>(null);

  function goToOtpStep(nextEmail: string, hint?: string | null) {
    setEmail(nextEmail);
    setRateLimitHint(hint ?? null);
    setParams(
      { email: nextEmail, step: "otp" },
      { replace: true },
    );
  }

  function onSendCode(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    setRateLimitHint(null);
    const nextEmail = email.trim();
    forgot.mutate(nextEmail, {
      onSuccess: () => goToOtpStep(nextEmail),
      onError: (error) => {
        // Firebase already delivered a code; still open the OTP form so the user can continue.
        if (isFirebaseEmailRateLimited(error)) {
          goToOtpStep(nextEmail, getApiErrorMessage(error));
        }
      },
    });
  }

  function onReset(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    reset.mutate(
      { email: email.trim(), otp: otp.trim(), password },
      {
        onSuccess: () => {
          navigate("/login", { replace: true, state: { passwordReset: true } });
        },
      },
    );
  }

  function onResend() {
    setLocalError(null);
    setRateLimitHint(null);
    const nextEmail = email.trim();
    forgot.mutate(nextEmail, {
      onSuccess: () => goToOtpStep(nextEmail),
      onError: (error) => {
        if (isFirebaseEmailRateLimited(error)) {
          goToOtpStep(nextEmail, getApiErrorMessage(error));
        }
      },
    });
  }

  const emailError =
    forgot.error && step === "email" && !isFirebaseEmailRateLimited(forgot.error)
      ? isRateLimited(forgot.error)
        ? "Too many attempts. Try again later."
        : getApiErrorMessage(forgot.error)
      : null;

  const resetError =
    localError ??
    (reset.error
      ? isRateLimited(reset.error)
        ? "Too many attempts. Try again later."
        : getApiErrorMessage(reset.error)
      : null);

  return (
    <AuthLayout>
      <Card className="shadow-card">
        <h1 className="font-display text-2xl font-bold tracking-tight text-tc-fg">
          {step === "otp" ? "Enter reset code" : "Forgot password"}
        </h1>
        <p className="mt-1 text-sm text-tc-muted">
          {step === "otp"
            ? `We emailed a 6-digit code to ${email}. Enter it with your new password. Use the number after “Hello” in the email (ignore any Firebase link).`
            : "If an account exists, we email a 6-digit reset code. After you send it, this page asks for the code and your new password."}
        </p>

        {step === "email" ? (
          <form className="mt-6 flex flex-col gap-4" onSubmit={onSendCode}>
            <Field>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <FormError>{emailError}</FormError>
            <Button type="submit" disabled={forgot.isPending} className="w-full">
              {forgot.isPending ? "Sending…" : "Send reset code"}
            </Button>
            <Link to="/login" className="text-sm text-tc-muted hover:text-tc-fg">
              Back to sign in
            </Link>
          </form>
        ) : (
          <form className="mt-6 flex flex-col gap-4" onSubmit={onReset}>
            <Field>
              <Label htmlFor="otp">6-digit code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
              />
            </Field>
            <Field>
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            <FormError>{resetError}</FormError>
            {rateLimitHint ? <FormHint>{rateLimitHint}</FormHint> : null}
            {forgot.isSuccess && !rateLimitHint ? <FormHint>Code sent. Check your inbox.</FormHint> : null}
            <Button type="submit" disabled={reset.isPending || otp.length !== 6} className="w-full">
              {reset.isPending ? "Updating…" : "Update password"}
            </Button>
            <div className="flex justify-between text-sm text-tc-muted">
              <button
                type="button"
                className="transition hover:text-tc-fg disabled:opacity-50"
                disabled={forgot.isPending}
                onClick={onResend}
              >
                {forgot.isPending ? "Sending…" : "Resend code"}
              </button>
              <button
                type="button"
                className="transition hover:text-tc-fg"
                onClick={() => {
                  setOtp("");
                  setPassword("");
                  setConfirm("");
                  setRateLimitHint(null);
                  setParams({}, { replace: true });
                }}
              >
                Change email
              </button>
            </div>
          </form>
        )}
      </Card>
    </AuthLayout>
  );
}
