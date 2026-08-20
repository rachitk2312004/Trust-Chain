import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  LogOut,
  Moon,
  Search,
  ShieldAlert,
  Sun,
  UserRound,
} from "lucide-react";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { NotificationBell } from "../features/notifications/NotificationBell";
import { useLogout } from "../features/auth/hooks";
import { usePermissions } from "../hooks/usePermissions";
import { getWorkspacePersona } from "../lib/workspacePersona";
import { useSessionStore } from "../lib/sessionStore";
import { useTheme } from "../lib/theme";
import { cn } from "../lib/cn";

const LazyNotificationCenter = lazy(() =>
  import("../features/notifications/NotificationCenter").then((m) => ({
    default: m.NotificationCenter,
  })),
);

/** Bell badge loads immediately; full panel + SSE load after idle or first click. */
function TopBarNotifications() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setReady(true), { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  if (!ready) {
    return (
      <div className="relative">
        <NotificationBell open={false} onToggle={() => setReady(true)} live={false} />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="relative">
          <NotificationBell open={false} onToggle={() => {}} live={false} />
        </div>
      }
    >
      <LazyNotificationCenter />
    </Suspense>
  );
}

export function AppTopBar() {
  const user = useSessionStore((s) => s.user);
  const logout = useLogout();
  const { isSuperAdmin, roles, organizationId } = usePermissions();
  const persona = useMemo(
    () => getWorkspacePersona(roles, organizationId),
    [roles, organizationId],
  );
  const { resolved, toggle } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = useMemo(() => {
    const email = user?.email ?? "TC";
    return email.slice(0, 2).toUpperCase();
  }, [user?.email]);

  return (
    <header className="sticky top-0 z-30 border-b border-tc-border/80 bg-tc-surface/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4 md:gap-3 md:px-6">
        <div className="hidden min-w-0 shrink-0 lg:block lg:w-[14rem] xl:w-[16rem]">
          <p
            className={cn(
              "truncate text-xs font-semibold uppercase tracking-[0.14em]",
              persona.accentClass,
            )}
          >
            {persona.title}
          </p>
          <p className="truncate text-sm text-tc-muted">{persona.subtitle}</p>
        </div>

        <form
          className="relative mx-auto hidden min-w-0 flex-1 md:block md:max-w-sm lg:max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            const q = query.trim();
            navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tc-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Global search…"
            className="tc-focus w-full rounded-xl border border-tc-border bg-tc-canvas/70 py-2 pl-10 pr-3 text-sm text-tc-fg placeholder:text-tc-muted lg:pr-14"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-tc-border px-1.5 py-0.5 text-[10px] text-tc-muted lg:inline">
            ⌘K
          </kbd>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <OrganizationSwitcher />

          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="tc-focus inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-tc-border text-tc-muted transition hover:bg-tc-surface-2 hover:text-tc-fg"
          >
            {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative">
            <TopBarNotifications />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="tc-focus inline-flex cursor-pointer items-center gap-2 rounded-xl border border-tc-border px-2 py-1.5 transition hover:bg-tc-surface-2"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-semibold text-white">
                {initials}
              </span>
              <span className="hidden max-w-[140px] truncate text-sm text-tc-fg sm:inline">
                {user?.email ?? "Account"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-tc-muted" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-tc-border bg-tc-surface shadow-elevated">
                {isSuperAdmin ? (
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-amber-700 hover:bg-tc-surface-2 dark:text-amber-300"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Admin console
                  </Link>
                ) : null}
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-tc-fg hover:bg-tc-surface-2"
                >
                  <UserRound className="h-4 w-4 text-tc-muted" />
                  Profile & settings
                </Link>
                <Link
                  to="/sessions"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-tc-fg hover:bg-tc-surface-2"
                >
                  <Bell className="h-4 w-4 text-tc-muted" />
                  Sessions
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
