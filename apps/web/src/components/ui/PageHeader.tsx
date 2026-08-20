import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("mb-2 flex flex-wrap items-start justify-between gap-4", className)}
    >
      <div className="min-w-0">
        {breadcrumbs ? <div className="mb-2 text-xs text-tc-muted">{breadcrumbs}</div> : null}
        <h1 className="font-display text-3xl font-bold tracking-tight text-tc-fg md:text-4xl">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-tc-muted md:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </motion.div>
  );
}
