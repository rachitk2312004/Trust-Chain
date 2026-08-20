import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";

export type AuthBannerVariant = "success" | "info" | "warning";

const variantStyles: Record<
  AuthBannerVariant,
  { ring: string; bg: string; icon: string; glow: string }
> = {
  success: {
    ring: "border-emerald-500/30",
    bg: "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent",
    icon: "text-emerald-500",
    glow: "shadow-[0_0_40px_-8px_rgba(16,185,129,0.45)]",
  },
  info: {
    ring: "border-blue-500/30",
    bg: "bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent",
    icon: "text-blue-500",
    glow: "shadow-[0_0_40px_-8px_rgba(37,99,235,0.35)]",
  },
  warning: {
    ring: "border-amber-500/30",
    bg: "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent",
    icon: "text-amber-500",
    glow: "shadow-[0_0_40px_-8px_rgba(217,119,6,0.35)]",
  },
};

export function AuthStatusBanner({
  variant,
  title,
  message,
  icon,
  autoDismissMs,
  onDismiss,
}: {
  variant: AuthBannerVariant;
  title: string;
  message?: string;
  icon?: "success" | "key" | "alert" | "sparkle";
  autoDismissMs?: number;
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const styles = variantStyles[variant];
  const Icon =
    icon === "key"
      ? KeyRound
      : icon === "alert"
        ? AlertCircle
        : icon === "sparkle"
          ? Sparkles
          : CheckCircle2;

  useEffect(() => {
    if (!autoDismissMs) return;
    const timer = window.setTimeout(() => setVisible(false), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs]);

  return (
    <AnimatePresence onExitComplete={onDismiss}>
      {visible ? (
        <motion.div
          key="auth-banner"
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 28,
          }}
          className={cn(
            "relative overflow-hidden rounded-2xl border p-4",
            styles.ring,
            styles.bg,
            styles.glow,
          )}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative flex gap-3">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.08 }}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/60",
                styles.icon,
              )}
            >
              <Icon className="h-5 w-5" />
            </motion.div>
            <div className="min-w-0 pt-0.5">
              <p className="font-display text-sm font-semibold tracking-tight text-tc-fg">{title}</p>
              {message ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="mt-1 text-sm leading-relaxed text-tc-muted"
                >
                  {message}
                </motion.p>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 + i * 0.06, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

export function AuthFormMotion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      className={className}
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      {children}
    </motion.div>
  );
}

export function AuthFieldMotion({
  index,
  children,
  className,
}: {
  index: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div custom={index} variants={fieldVariants} className={className}>
      {children}
    </motion.div>
  );
}
