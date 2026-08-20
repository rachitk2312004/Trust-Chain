import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Button, Field, FormError, Input, Label } from "@trustchain/ui";
import { AuthFieldMotion, AuthFormMotion } from "../features/auth/AuthStatusBanner";
import { useRegister } from "../features/auth/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { getApiErrorMessage, isRateLimited } from "../lib/apiErrors";
import { AuthLayout } from "../layouts/AuthLayout";

export function RegisterPage() {
  const register = useRegister();
  const feedback = useFeedback();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    register.mutate(
      {
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      },
      {
        onError: (err) => feedback.error(err, "Registration failed"),
      },
    );
  }

  const errorMessage = register.error
    ? isRateLimited(register.error)
      ? "Too many attempts. Try again later."
      : getApiErrorMessage(register.error)
    : null;

  return (
    <AuthLayout>
      <div className="relative overflow-hidden rounded-2xl border border-tc-border bg-tc-surface p-6 shadow-[0_24px_64px_-32px_rgba(15,23,42,0.18)]">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tc-surface-2 text-tc-accent">
            <UserPlus className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-tc-fg">Create account</h1>
            <p className="mt-1 text-sm text-tc-muted">Start building on TrustChain in minutes.</p>
          </div>
        </div>
        <form onSubmit={onSubmit}>
          <AuthFormMotion className="flex flex-col gap-4">
            <AuthFieldMotion index={0}>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </Field>
                <Field>
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Field>
              </div>
            </AuthFieldMotion>
            <AuthFieldMotion index={1}>
              <Field>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            </AuthFieldMotion>
            <AuthFieldMotion index={2}>
              <Field>
                <Label htmlFor="password">Password</Label>
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
            </AuthFieldMotion>
            <AuthFieldMotion index={3}>
              <FormError>{errorMessage}</FormError>
              <Button type="submit" disabled={register.isPending} className="w-full">
                {register.isPending ? "Creating…" : "Create account"}
              </Button>
              <p className="text-sm text-tc-muted">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-tc-fg underline-offset-2 hover:underline">
                  Sign in
                </Link>
              </p>
            </AuthFieldMotion>
          </AuthFormMotion>
        </form>
      </div>
    </AuthLayout>
  );
}
