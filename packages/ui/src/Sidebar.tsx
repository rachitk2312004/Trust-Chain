import type { ReactNode } from "react";
import { NavLink } from "./nav-link-types.js";
import { cn } from "./lib/cn.js";

export type SidebarItem = {
  to: string;
  label: string;
  end?: boolean;
};

export type SidebarProps = {
  title?: string;
  items: SidebarItem[];
  footer?: ReactNode;
  className?: string;
  linkComponent?: NavLink;
};

export function Sidebar({
  title = "TrustChain",
  items,
  footer,
  className,
  linkComponent: Link = DefaultLink,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-60 flex-col border-r border-[var(--tc-border)] bg-[var(--tc-surface)]",
        className,
      )}
    >
      <div className="border-b border-[var(--tc-border)] px-4 py-4">
        <p className="text-sm font-semibold tracking-tight text-[var(--tc-fg)]">{title}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-[var(--tc-surface-2)] text-[var(--tc-fg)]"
                  : "text-[var(--tc-muted)] hover:bg-[var(--tc-surface-2)] hover:text-[var(--tc-fg)]",
              )
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {footer ? <div className="border-t border-[var(--tc-border)] p-3">{footer}</div> : null}
    </aside>
  );
}

function DefaultLink({
  to,
  className,
  children,
}: {
  to: string;
  end?: boolean;
  className?: string | ((args: { isActive: boolean }) => string);
  children: ReactNode;
}) {
  const resolved = typeof className === "function" ? className({ isActive: false }) : className;
  return (
    <a href={to} className={resolved}>
      {children}
    </a>
  );
}
