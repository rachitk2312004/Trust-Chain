import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Field, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { useResetPassword } from "../features/auth/hooks";
import { getApiErrorMessage, isRateLimited } from "../lib/apiErrors";
import { AuthLayout } from "../layouts/AuthLayout";
import { Card } from "../components/ui";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const tokenFromQuery = params.get("token") ?? "";
  const reset = useResetPassword();
  const [token, setToken] = useState(tokenFromQuery);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    if (!token.trim()) {
      setLocalError("Reset token is required.");
      return;
    }
    reset.mutate({ token: token.trim(), password });
  }

  const errorMessage =
    localError ??
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
          {!tokenFromQuery ? (
            <Field>
              <Label htmlFor="token">Reset token</Label>
              <Input id="token" required value={token} onChange={(e) => setToken(e.target.value)} />
              <FormHint>Paste the token if the email link did not open this page directly.</FormHint>
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
          <Button type="submit" disabled={reset.isPending} className="w-full">
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
