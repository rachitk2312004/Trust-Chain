import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Field, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { useResetPassword } from "../features/auth/hooks";
import { getApiErrorMessage, isRateLimited } from "../lib/apiErrors";
import { AuthLayout } from "../layouts/AuthLayout";
import { Card } from "../components/ui";

/**
 * Handles:
 * - Preferred: /forgot-password OTP flow (email + 6-digit code)
 * - Legacy Firebase link: ?mode=resetPassword&oobCode=...
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const oobFromQuery = params.get("oobCode") ?? "";
  const mode = params.get("mode") ?? "";
  const reset = useResetPassword();
  const [oobCode] = useState(oobFromQuery);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const hasFirebaseCode = Boolean(oobCode.trim());
  const wrongMode = Boolean(mode) && mode !== "resetPassword";

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    if (!hasFirebaseCode) {
      setLocalError("Use Forgot password to get a 6-digit reset code.");
      return;
    }
    reset.mutate({ password, oobCode: oobCode.trim() });
  }

  const errorMessage =
    localError ??
    (wrongMode
      ? "This link is not a password reset link. Use Forgot password instead."
      : null) ??
    (reset.error
      ? isRateLimited(reset.error)
        ? "Too many attempts. Try again later."
        : getApiErrorMessage(reset.error)
      : null);

  if (!hasFirebaseCode) {
    return (
      <AuthLayout>
        <Card className="shadow-card">
          <h1 className="font-display text-2xl font-bold tracking-tight text-tc-fg">Reset password</h1>
          <p className="mt-1 text-sm text-tc-muted">
            Password reset now uses a 6-digit email code on the Forgot password page.
          </p>
          <Link
            to="/forgot-password"
            className="mt-6 inline-flex text-sm font-medium text-tc-fg underline-offset-2 hover:underline"
          >
            Go to Forgot password
          </Link>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card className="shadow-card">
        <h1 className="font-display text-2xl font-bold tracking-tight text-tc-fg">Reset password</h1>
        <p className="mt-1 text-sm text-tc-muted">
          Choose a new password. This completes the Firebase reset link.
        </p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <FormHint>Reset code from your email link is ready. Enter a new password below.</FormHint>
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
          <FormError>{errorMessage}</FormError>
          <Button type="submit" disabled={reset.isPending || wrongMode} className="w-full">
            {reset.isPending ? "Updating…" : "Update password"}
          </Button>
          <Link to="/login" className="text-sm text-tc-muted hover:text-tc-fg">
            Back to sign in
          </Link>
        </form>
      </Card>
    </AuthLayout>
  );
}
