import type { HTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glass?: boolean;
  padded?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">;

export function Card({
  children,
  className,
  hover = false,
  glass = false,
  padded = true,
  onClick,
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      whileHover={hover ? { y: -2, transition: { duration: 0.18 } } : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-tc-border bg-tc-surface shadow-soft",
        glass && "tc-glass",
        padded && "p-6",
        hover && "cursor-pointer transition-shadow hover:shadow-card",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold tracking-tight text-tc-fg">{title}</h3>
        {description ? <p className="mt-1 text-sm text-tc-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
