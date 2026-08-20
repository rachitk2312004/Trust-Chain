import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Field, FormError, Input, Label } from "@trustchain/ui";
import { useVerifyMfa } from "../features/auth/hooks";
import { getApiErrorMessage, isRateLimited } from "../lib/apiErrors";
import { useSessionStore } from "../lib/sessionStore";
import { AuthLayout } from "../layouts/AuthLayout";
import { Card } from "../components/ui";

export function MfaPage() {
  const verify = useVerifyMfa();
  const clearMfa = useSessionStore((s) => s.setMfaToken);
  const [code, setCode] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    verify.mutate({
      code: code.trim(),
      deviceName: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : undefined,
    });
  }

  const errorMessage = verify.error
    ? isRateLimited(verify.error)
      ? "Too many attempts. Try again later."
      : getApiErrorMessage(verify.error)
    : null;

  return (
    <AuthLayout>
      <Card className="shadow-card">
        <h1 className="font-display text-2xl font-bold tracking-tight text-tc-fg">Multi-factor authentication</h1>
        <p className="mt-1 text-sm text-tc-muted">Enter the 6-digit code from your authenticator app.</p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <Field>
            <Label htmlFor="code">Authentication code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <FormError>{errorMessage}</FormError>
          <Button type="submit" disabled={verify.isPending} className="w-full">
            {verify.isPending ? "Verifying…" : "Verify"}
          </Button>
          <Link
            to="/login"
            className="text-sm text-tc-muted hover:text-tc-fg"
            onClick={() => clearMfa(null)}
          >
            Cancel and sign in again
          </Link>
        </form>
      </Card>
    </AuthLayout>
  );
}
