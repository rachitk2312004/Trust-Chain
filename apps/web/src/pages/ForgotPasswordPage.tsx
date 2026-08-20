import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Field, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { useForgotPassword } from "../features/auth/hooks";
import { getApiErrorMessage, isRateLimited } from "../lib/apiErrors";
import { AuthLayout } from "../layouts/AuthLayout";
import { Card } from "../components/ui";

export function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    forgot.mutate(email.trim());
  }

  const errorMessage = forgot.error
    ? isRateLimited(forgot.error)
      ? "Too many attempts. Try again later."
      : getApiErrorMessage(forgot.error)
    : null;

  return (
    <AuthLayout>
      <Card className="shadow-card">
        <h1 className="font-display text-2xl font-bold tracking-tight text-tc-fg">Forgot password</h1>
        <p className="mt-1 text-sm text-tc-muted">
          We email a reset link when the account exists.
        </p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
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
          <FormError>{errorMessage}</FormError>
          {forgot.isSuccess ? (
            <FormHint>If an account exists for that email, a reset message was sent.</FormHint>
          ) : null}
          <Button type="submit" disabled={forgot.isPending} className="w-full">
            {forgot.isPending ? "Sending…" : "Send reset email"}
          </Button>
          <Link to="/login" className="text-sm text-tc-muted hover:text-tc-fg">
            Back to sign in
          </Link>
        </form>
      </Card>
    </AuthLayout>
  );
}
