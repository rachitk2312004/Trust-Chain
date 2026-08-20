import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  HeartPulse,
  LayoutDashboard,
  Package,
  ScrollText,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Users,
  Gavel,
  BarChart3,
  ServerCog,
} from "lucide-react";
import { cn } from "../lib/cn";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const ADMIN_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/audit", label: "Audit", icon: ScrollText },
    ],
  },
  {
    id: "tenancy",
    label: "Tenancy",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/organizations", label: "Organizations", icon: Building2 },
      { to: "/admin/tenants", label: "Tenants", icon: Package },
      { to: "/admin/permissions", label: "Permissions", icon: Shield },
    ],
  },
  {
    id: "control",
    label: "Control plane",
    items: [
      { to: "/admin/feature-flags", label: "Feature flags", icon: Flag },
      { to: "/admin/configuration", label: "Configuration", icon: Settings2 },
      { to: "/admin/policies", label: "Policies", icon: Gavel },
      { to: "/admin/inspection", label: "Inspection", icon: Search },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    items: [
      { to: "/admin/health", label: "Health", icon: HeartPulse },
      { to: "/platform", label: "Platform", icon: ServerCog, end: true },
      { to: "/platform/operations", label: "Platform ops", icon: Activity },
    ],
  },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ADMIN_GROUPS.map((g) => [g.id, true])),
  );

  const groups = useMemo(() => ADMIN_GROUPS, []);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-white/5 bg-slate-950 text-slate-100 transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[272px]",
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-2")}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="font-display text-sm font-bold tracking-tight">Admin console</p>
            <p className="truncate text-[11px] text-slate-400">Platform control plane</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => {
          const open = openGroups[group.id] ?? true;
          return (
            <div key={group.id}>
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                  className="mb-1 flex w-full cursor-pointer items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                >
                  {group.label}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-0" : "-rotate-90")} />
                </button>
              ) : null}
              <AnimatePresence initial={false}>
                {(collapsed || open) && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-0.5 overflow-hidden"
                  >
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={item.end}
                            title={item.label}
                            className={({ isActive }) =>
                              cn(
                                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                                collapsed && "justify-center px-2",
                                isActive
                                  ? "bg-amber-500/15 text-amber-200"
                                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-amber-300")} />
                                {!collapsed ? <span className="truncate">{item.label}</span> : null}
                                {!collapsed && isActive ? (
                                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-300" />
                                ) : null}
                              </>
                            )}
                          </NavLink>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed ? "Collapse" : null}
        </button>
      </div>
    </aside>
  );
}
