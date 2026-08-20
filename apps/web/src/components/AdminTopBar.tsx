import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useLogout } from "../features/auth/hooks";
import { useSessionStore } from "../lib/sessionStore";
import { useTheme } from "../lib/theme";
import { cn } from "../lib/cn";

export function AdminTopBar() {
  const user = useSessionStore((s) => s.user);
  const logout = useLogout();
  const { resolved, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = useMemo(() => {
    const email = user?.email ?? "SA";
    return email.slice(0, 2).toUpperCase();
  }, [user?.email]);

  return (
    <header className="sticky top-0 z-30 border-b border-tc-border/80 bg-tc-surface/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
            Super admin
          </p>
          <p className="truncate text-sm text-tc-muted">Platform administration · no workspace tools</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="tc-focus inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-tc-border text-tc-muted transition hover:bg-tc-surface-2 hover:text-tc-fg"
          >
            {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="tc-focus inline-flex cursor-pointer items-center gap-2 rounded-xl border border-tc-border px-2 py-1.5 transition hover:bg-tc-surface-2"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-xs font-semibold text-white">
                {initials}
              </span>
              <span className="hidden max-w-[140px] truncate text-sm text-tc-fg sm:inline">
                {user?.email ?? "Admin"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-tc-muted" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-tc-border bg-tc-surface shadow-elevated">
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-tc-fg hover:bg-tc-surface-2"
                >
                  <UserRound className="h-4 w-4 text-tc-muted" />
                  Account settings
                </Link>
                <button
                  type="button"
                  disabled={logout.isPending}
                  onClick={() => logout.mutate()}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 border-t border-tc-border px-3 py-2.5 text-sm text-rose-600 hover:bg-tc-surface-2",
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  {logout.isPending ? "Signing out…" : "Sign out"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
