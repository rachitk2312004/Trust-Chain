import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Button, Field, FormError, Input, Label } from "@trustchain/ui";
import { AuthFieldMotion, AuthFormMotion } from "../features/auth/AuthStatusBanner";
import { useRegister, useResendEmailVerification, useVerifyEmailOtp } from "../features/auth/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { getApiErrorMessage, isRateLimited, parseApiError } from "../lib/apiErrors";
import { AuthLayout } from "../layouts/AuthLayout";

export function RegisterPage() {
  const register = useRegister();
  const verifyOtp = useVerifyEmailOtp();
  const resend = useResendEmailVerification();
  const feedback = useFeedback();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const presetEmail = params.get("email")?.trim() ?? "";
  const presetOtp = (params.get("otp") ?? "").replace(/\D/g, "").slice(0, 6);
  const startOnOtp = params.get("verify") === "1" && Boolean(presetEmail);

  const [step, setStep] = useState<"form" | "otp">(startOnOtp ? "otp" : "form");
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [otp, setOtp] = useState(presetOtp);

  function onRegister(event: FormEvent) {
    event.preventDefault();
    register.mutate(
      {
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      },
      {
        onSuccess: () => {
          setStep("otp");
          setOtp("");
          feedback.success("Check your email", "Firebase sent a 6-digit verification code. It is not sent again when you sign in.");
        },
        onError: (err) => feedback.error(err, "Registration failed"),
      },
    );
  }

  function onVerify(event: FormEvent) {
    event.preventDefault();
    verifyOtp.mutate(
      { email: email.trim(), otp: otp.trim() },
      {
        onSuccess: () => {
          navigate("/login", {
            replace: true,
            state: {
              registered: true,
              emailVerified: true,
              email: email.trim(),
              firstName: firstName.trim() || undefined,
            },
          });
        },
        onError: (err) => feedback.error(err, "Could not verify email"),
      },
    );
  }

  function onResend() {
    resend.mutate(email.trim(), {
      onSuccess: () => feedback.success("Code sent", "Check your inbox for a new OTP."),
      onError: (err) => feedback.error(err, "Could not resend the code"),
    });
  }

  const formError = register.error
    ? isRateLimited(register.error)
      ? "Too many attempts. Try again later."
      : getApiErrorMessage(register.error)
    : null;
  const otpStepError = resend.error ?? verifyOtp.error;
  const otpError = otpStepError
    ? isRateLimited(otpStepError) && parseApiError(otpStepError).code === "AUTH_RATE_LIMITED"
      ? "Too many attempts. Try again later."
      : getApiErrorMessage(otpStepError)
    : null;

  return (
    <AuthLayout>
      <div className="relative overflow-hidden rounded-2xl border border-tc-border bg-tc-surface p-6 shadow-[0_24px_64px_-32px_rgba(15,23,42,0.18)]">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tc-surface-2 text-tc-accent">
            {step === "otp" ? <ShieldCheck className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-tc-fg">
              {step === "otp" ? "Verify your email" : "Create account"}
            </h1>
            <p className="mt-1 text-sm text-tc-muted">
              {step === "otp"
                ? `Firebase emailed a 6-digit code to ${email}. Enter it once to verify — later logins only need your password.`
                : "Start building on TrustChain in minutes."}
            </p>
          </div>
        </div>

        {step === "form" ? (
          <form onSubmit={onRegister}>
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
                <FormError>{formError}</FormError>
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
        ) : (
          <form onSubmit={onVerify}>
            <AuthFormMotion className="flex flex-col gap-4">
              <AuthFieldMotion index={0}>
                <Field>
                  <Label htmlFor="otp">Verification code</Label>
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
              </AuthFieldMotion>
              <AuthFieldMotion index={1}>
                <FormError>{otpError}</FormError>
                <Button type="submit" disabled={verifyOtp.isPending || otp.length !== 6} className="w-full">
                  {verifyOtp.isPending ? "Verifying…" : "Verify email"}
                </Button>
                <div className="flex justify-between text-sm text-tc-muted">
                  <button
                    type="button"
                    className="transition hover:text-tc-fg disabled:opacity-50"
                    disabled={resend.isPending || !email.trim()}
                    onClick={onResend}
                  >
                    {resend.isPending ? "Sending…" : "Resend code"}
                  </button>
                  <button
                    type="button"
                    className="transition hover:text-tc-fg"
                    onClick={() => {
                      setStep("form");
                      setOtp("");
                    }}
                  >
                    Edit details
                  </button>
                </div>
              </AuthFieldMotion>
            </AuthFormMotion>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
