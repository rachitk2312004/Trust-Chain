import { useMemo, useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Award,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  FileText,
  Gavel,
  Globe2,
  LayoutDashboard,
  Link2,
  MapPinned,
  QrCode,
  Scale,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Signature,
  Store,
  Bell,
  Users,
  Wallet,
  Workflow,
  Server,
  Layers,
} from "lucide-react";
import { cn } from "../lib/cn";
import { prefetchRoute } from "../lib/routePrefetch";
import { usePermissions } from "../hooks/usePermissions";
import { isOrgAdminOnly } from "../lib/homeRoute";
import { getWorkspacePersona, isCertificateHolderOnly } from "../lib/workspacePersona";
import { prefetchHolderRoutes } from "../lib/routePrefetch";
import { SHOW_BLOCKCHAIN_WALLET_NAV } from "../lib/demoFlags";

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

export function AppSidebar() {
  const {
    isOpsAdmin,
    isSuperAdmin,
    isPlatformAdminOnly: platformAdminOnly,
    isOrgAdmin,
    isOrgMember,
    showHolderFeatures: holderNav,
    roles,
    organizationId,
  } = usePermissions();
  const orgAdminOnly = isOrgAdminOnly(roles, organizationId);
  const holderOnly = isCertificateHolderOnly(roles, organizationId);
  const persona = useMemo(
    () => getWorkspacePersona(roles, organizationId),
    [roles, organizationId],
  );
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    workspace: true,
    trust: true,
    enterprise: true,
    platform: true,
  });

  const groups = useMemo<NavGroup[]>(() => {
    if (platformAdminOnly) {
      return [
        {
          id: "platform",
          label: "Platform",
          items: [{ to: "/admin", label: "Admin console", icon: Shield, end: true }],
        },
        {
          id: "account",
          label: "Account",
          items: [
            { to: "/sessions", label: "Sessions", icon: Server },
            { to: "/settings", label: "Settings", icon: Settings },
          ],
        },
      ];
    }

    if (orgAdminOnly) {
      const orgBase = organizationId ? `/organizations/${organizationId}` : "/organizations";
      return [
        {
          id: "org-admin",
          label: "Organization",
          items: [
            { to: orgBase, label: "Overview", icon: LayoutDashboard, end: true },
            { to: `${orgBase}/members`, label: "Members", icon: Users },
            { to: `${orgBase}/invitations`, label: "Invitations", icon: Building2 },
            { to: "/certificates", label: "Certificates", icon: Award },
            { to: "/verification", label: "Verification", icon: ShieldCheck },
            { to: "/audit", label: "Audit", icon: Activity },
            { to: "/notifications", label: "Notifications", icon: Bell },
          ],
        },
        {
          id: "account",
          label: "Account",
          items: [
            { to: "/sessions", label: "Sessions", icon: Server },
            { to: "/settings", label: "Settings", icon: Settings },
          ],
        },
      ];
    }

    if (holderOnly) {
      return [
        {
          id: "wallet",
          label: "Certificate wallet",
          items: [
            { to: "/my-certificates", label: "My certificates", icon: Award, end: true },
            { to: "/verify", label: "Verify document", icon: ShieldCheck },
            // Phase 1 viva: blockchain wallet linking hidden from nav (see demoFlags.ts)
            ...(SHOW_BLOCKCHAIN_WALLET_NAV
              ? [{ to: "/wallets", label: "Wallets", icon: Wallet }]
              : []),
          ],
        },
        {
          id: "workspace",
          label: "Workspace",
          items: [
            { to: "/organizations", label: "Organizations", icon: Building2 },
            { to: "/notifications", label: "Notifications", icon: Bell },
          ],
        },
        {
          id: "account",
          label: "Account",
          items: [
            { to: "/sessions", label: "Sessions", icon: Server },
            { to: "/settings", label: "Settings", icon: Settings },
          ],
        },
      ];
    }

    const workspace: NavGroup = {
      id: "workspace",
      label: "Workspace",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/organizations", label: "Organizations", icon: Building2 },
        { to: "/documents", label: "Documents", icon: FileText },
        { to: "/search", label: "Search", icon: Search },
        { to: "/notifications", label: "Notifications", icon: Bell },
      ],
    };

    const trust: NavGroup = {
      id: "trust",
      label: "Trust",
      items: [
        ...(holderNav ? [{ to: "/my-certificates", label: "My certificates", icon: Award }] : []),
        ...(isOrgMember
          ? [
              { to: "/verification", label: "Verification", icon: ShieldCheck },
              { to: "/certificates", label: "Certificates", icon: Award },
              { to: "/signatures", label: "Signatures", icon: Signature },
              { to: "/qr", label: "QR", icon: QrCode },
            ]
          : holderNav
            ? [{ to: "/verification/public", label: "Verify document", icon: ShieldCheck }]
            : []),
        // Phase 1 viva: blockchain wallet linking hidden from nav (see demoFlags.ts)
        ...(holderNav && SHOW_BLOCKCHAIN_WALLET_NAV
          ? [{ to: "/wallets", label: "Wallets", icon: Wallet }]
          : []),
      ],
    };

    const enterprise: NavGroup = {
      id: "enterprise",
      label: "Enterprise",
      items: [],
    };

    if (isOrgAdmin) {
      enterprise.items.push(
        { to: "/audit", label: "Audit", icon: Activity },
        { to: "/compliance", label: "Compliance", icon: Scale },
        { to: "/evidence", label: "Evidence", icon: Layers },
        { to: "/governance", label: "Governance", icon: Gavel },
        { to: "/retention", label: "Retention", icon: Workflow },
        { to: "/enterprise", label: "SSO / Roles", icon: Users },
        { to: "/organization", label: "Org platform", icon: Building2 },
        { to: "/regions", label: "Regions", icon: MapPinned },
        { to: "/recovery", label: "Recovery", icon: Shield },
        { to: "/integrations", label: "Integrations", icon: Link2 },
        { to: "/marketplace", label: "Marketplace", icon: Store },
        { to: "/reputation", label: "Reputation", icon: Globe2 },
      );
    }

    if (isOpsAdmin) {
      enterprise.items.push({ to: "/notifications/ops", label: "Notify ops", icon: Bell });
    }

    const account: NavGroup = {
      id: "account",
      label: "Account",
      items: [
        { to: "/sessions", label: "Sessions", icon: Server },
        { to: "/settings", label: "Settings", icon: Settings },
      ],
    };

    if (isOrgAdmin || isSuperAdmin) {
      account.items.unshift({ to: "/developer", label: "Developer", icon: Code2 });
    }

    return [workspace, trust, ...(enterprise.items.length ? [enterprise] : []), account];
  }, [holderNav, holderOnly, isOpsAdmin, isOrgAdmin, isOrgMember, isSuperAdmin, orgAdminOnly, organizationId, platformAdminOnly]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => prefetchHolderRoutes(), { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => prefetchHolderRoutes(), 500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <aside
      className={cn(
        "sticky top-0 z-20 flex h-screen shrink-0 flex-col border-r border-white/5 bg-tc-sidebar text-tc-sidebar-fg transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[272px]",
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-5", collapsed && "justify-center px-2")}>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            persona.iconClass,
          )}
        >
          <ShieldCheck className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="font-display text-sm font-bold tracking-tight">{persona.consoleTitle}</p>
            <p className="truncate text-[11px] text-tc-sidebar-muted">{persona.consoleSubtitle}</p>
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
                  onClick={() => toggleGroup(group.id)}
                  className="mb-1 flex w-full cursor-pointer items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-tc-sidebar-muted"
                >
                  {group.label}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-0" : "-rotate-90")} />
                </button>
              ) : null}
              {(collapsed || open) && (
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          title={item.label}
                          onMouseEnter={() => prefetchRoute(item.to)}
                          onMouseDown={() => prefetchRoute(item.to)}
                          onFocus={() => prefetchRoute(item.to)}
                          className={({ isActive }) =>
                            cn(
                              "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                              collapsed && "justify-center px-2",
                              isActive
                                ? "bg-[var(--tc-sidebar-active)] text-emerald-300"
                                : "text-tc-sidebar-muted hover:bg-[var(--tc-sidebar-hover)] hover:text-tc-sidebar-fg",
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-emerald-400")} />
                              {!collapsed ? <span className="truncate">{item.label}</span> : null}
                              {!collapsed && isActive ? (
                                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              ) : null}
                            </>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-tc-sidebar-muted transition hover:bg-[var(--tc-sidebar-hover)] hover:text-tc-sidebar-fg"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed ? "Collapse" : null}
        </button>
      </div>
    </aside>
  );
}
