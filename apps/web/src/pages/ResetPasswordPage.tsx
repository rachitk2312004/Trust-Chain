import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Field, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { useResetPassword } from "../features/auth/hooks";
import { getApiErrorMessage, isRateLimited } from "../lib/apiErrors";
import { AuthLayout } from "../layouts/AuthLayout";
import { Card } from "../components/ui";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  // Firebase emails use oobCode (+ mode=resetPassword). Legacy SMTP used token=.
  const oobFromQuery = params.get("oobCode") ?? "";
  const tokenFromQuery = params.get("token") ?? "";
  const mode = params.get("mode") ?? "";
  const reset = useResetPassword();
  const [oobCode, setOobCode] = useState(oobFromQuery);
  const [token, setToken] = useState(tokenFromQuery);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const hasFirebaseCode = Boolean(oobCode.trim());
  const hasLegacyToken = Boolean(token.trim());
  const wrongMode = Boolean(mode) && mode !== "resetPassword" && !hasLegacyToken;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    if (!hasFirebaseCode && !hasLegacyToken) {
      setLocalError("Open the reset link from your email, or paste the reset code.");
      return;
    }
    reset.mutate({
      password,
      ...(hasFirebaseCode ? { oobCode: oobCode.trim() } : { token: token.trim() }),
    });
  }

  const errorMessage =
    localError ??
    (wrongMode
      ? "This link is not a password reset link. Request a new reset from Forgot password."
      : null) ??
    (reset.error
      ? isRateLimited(reset.error)
        ? "Too many attempts. Try again later."
        : getApiErrorMessage(reset.error)
      : null);

  return (
    <AuthLayout>
      <Card className="shadow-card">
        <h1 className="font-display text-2xl font-bold tracking-tight text-tc-fg">Reset password</h1>
        <p className="mt-1 text-sm text-tc-muted">Choose a new password for your account.</p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          {!oobFromQuery && !tokenFromQuery ? (
            <Field>
              <Label htmlFor="oobCode">Reset code</Label>
              <Input
                id="oobCode"
                required
                value={oobCode || token}
                onChange={(e) => {
                  setOobCode(e.target.value);
                  setToken(e.target.value);
                }}
              />
              <FormHint>Paste the code from your email link if this page did not open automatically.</FormHint>
            </Field>
          ) : null}
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
