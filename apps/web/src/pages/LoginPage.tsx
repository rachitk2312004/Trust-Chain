import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button, Field, FormError, Input, Label } from "@trustchain/ui";
import {
  AuthFieldMotion,
  AuthFormMotion,
  AuthStatusBanner,
} from "../features/auth/AuthStatusBanner";
import { useLogin } from "../features/auth/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { getApiErrorMessage, isInvalidCredentials, isRateLimited } from "../lib/apiErrors";
import { AuthLayout } from "../layouts/AuthLayout";
import { cn } from "../lib/cn";

type LoginLocationState = {
  registered?: boolean;
  passwordReset?: boolean;
  sessionExpired?: boolean;
  authEvent?: string;
  authMessage?: string;
  email?: string;
  firstName?: string;
};

export function LoginPage() {
  const login = useLogin();
  const location = useLocation();
  const feedback = useFeedback();
  const state = location.state as LoginLocationState | null;

  const [email, setEmail] = useState(state?.email ?? "");
  const [password, setPassword] = useState("");
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  useEffect(() => {
    if (state?.email) setEmail(state.email);
  }, [state?.email]);

  const welcome = useMemo(() => {
    if (state?.registered && !welcomeDismissed) {
      const name = state.firstName?.trim();
      return {
        isNew: true,
        title: name ? `Welcome, ${name}` : "Welcome to TrustChain",
        subtitle: "Your account is ready. Sign in to enter your workspace.",
        banner: {
          variant: "success" as const,
          title: "Account created successfully",
          message: "Use the email and password you just registered with.",
          icon: "sparkle" as const,
        },
      };
    }
    if (state?.passwordReset && !welcomeDismissed) {
      return {
        isNew: false,
        title: "Sign in",
        subtitle: "Access your TrustChain workspace.",
        banner: {
          variant: "success" as const,
          title: "Password updated",
          message: "Sign in with your new password.",
          icon: "key" as const,
        },
      };
    }
    if (state?.sessionExpired && !welcomeDismissed) {
      return {
        isNew: false,
        title: "Sign in again",
        subtitle: "Access your TrustChain workspace.",
        banner: {
          variant: "warning" as const,
          title: "Session ended",
          message: state.authMessage ?? "Please sign in to continue.",
          icon: "alert" as const,
        },
      };
    }
    return {
      isNew: false,
      title: "Sign in",
      subtitle: "Access your TrustChain workspace.",
      banner: null,
    };
  }, [state, welcomeDismissed]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate(
      {
        email: email.trim(),
        password,
        deviceName: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : undefined,
      },
      {
        onSuccess: (data) => {
          if ("mfaRequired" in data && data.mfaRequired) {
            feedback.info("MFA required", "Enter the code from your authenticator.");
          } else {
            feedback.success("Signed in");
          }
        },
        onError: (err) => feedback.error(err, "Sign-in failed"),
      },
    );
  }

  const errorMessage = login.error
    ? isRateLimited(login.error)
      ? "Too many attempts. Try again later."
      : isInvalidCredentials(login.error)
        ? "Invalid email or password."
        : getApiErrorMessage(login.error)
    : null;

  return (
    <AuthLayout>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-tc-border bg-tc-surface p-6 shadow-[0_24px_64px_-32px_rgba(15,23,42,0.18)]",
          welcome.isNew && "border-emerald-500/25 ring-1 ring-emerald-500/10",
        )}
      >
        {welcome.isNew ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/15 blur-2xl"
            animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative"
        >
          <motion.div layout className="mb-5 flex items-start gap-3">
            <motion.span
              layout
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                welcome.isNew
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-tc-surface-2 text-tc-accent",
              )}
            >
              <ShieldCheck className="h-5 w-5" />
            </motion.span>
            <div>
              <motion.h1
                key={welcome.title}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="font-display text-2xl font-bold tracking-tight text-tc-fg"
              >
                {welcome.title}
              </motion.h1>
              <motion.p
                key={welcome.subtitle}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.05 }}
                className="mt-1 text-sm text-tc-muted"
              >
                {welcome.subtitle}
              </motion.p>
            </div>
          </motion.div>

          {welcome.banner ? (
            <div className="mb-5">
              <AuthStatusBanner
                {...welcome.banner}
                autoDismissMs={5000}
                onDismiss={() => setWelcomeDismissed(true)}
              />
            </div>
          ) : null}

          <form onSubmit={onSubmit}>
            <AuthFormMotion className="flex flex-col gap-4">
              <AuthFieldMotion index={0}>
                <Field>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    invalid={Boolean(errorMessage)}
                    autoFocus={welcome.isNew}
                  />
                </Field>
              </AuthFieldMotion>
              <AuthFieldMotion index={1}>
                <Field>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    invalid={Boolean(errorMessage)}
                  />
                </Field>
              </AuthFieldMotion>
              <AuthFieldMotion index={2}>
                <FormError>{errorMessage}</FormError>
                <Button type="submit" disabled={login.isPending} className="group w-full">
                  {login.isPending ? (
                    "Signing in…"
                  ) : welcome.isNew ? (
                    <>
                      Enter TrustChain
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </AuthFieldMotion>
              <AuthFieldMotion index={3}>
                <div className="flex justify-between text-sm text-tc-muted">
                  <Link to="/forgot-password" className="transition hover:text-tc-fg">
                    Forgot password
                  </Link>
                  <Link to="/register" className="transition hover:text-tc-fg">
                    Create account
                  </Link>
                </div>
              </AuthFieldMotion>
            </AuthFormMotion>
          </form>
        </motion.div>
      </div>
    </AuthLayout>
  );
}
