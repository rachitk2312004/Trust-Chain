import { Outlet, NavLink, useParams } from "react-router-dom";
import { Building2 } from "lucide-react";
import { FormError } from "@trustchain/ui";
import { useEffect, useMemo } from "react";
import { useOrganization } from "../features/organizations/hooks";
import { getOrganizationErrorMessage, isOrgNotFound } from "../lib/orgErrors";
import { useSessionStore } from "../lib/sessionStore";
import { usePermissions } from "../hooks/usePermissions";
import type { OrgCapability } from "../lib/permissions";

const tabs: Array<{ to: string; label: string; end?: boolean; capability?: OrgCapability }> = [
  { to: "", label: "Overview", end: true, capability: "org.view" },
  { to: "members", label: "Members", capability: "org.view" },
  { to: "join-requests", label: "Join requests", capability: "org.members.manage" },
  { to: "invitations", label: "Invitations", capability: "org.invite" },
  { to: "branches", label: "Branches", capability: "org.branches.manage" },
  { to: "departments", label: "Departments", capability: "org.departments.manage" },
  { to: "settings", label: "Settings", capability: "org.update" },
];

export function OrganizationLayout() {
  const { organizationId = "" } = useParams();
  const org = useOrganization(organizationId);
  const setActive = useSessionStore((s) => s.setActiveOrganizationId);
  const { can } = usePermissions(organizationId);

  useEffect(() => {
    if (organizationId) setActive(organizationId);
  }, [organizationId, setActive]);

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => !tab.capability || can(tab.capability)),
    [can],
  );

  const orgMeta = org.data;

  return (
    <>
      {org.isError ? (
        <div className="mb-4">
          <FormError>
            {isOrgNotFound(org.error)
              ? "Organization not found."
              : getOrganizationErrorMessage(org.error)}
          </FormError>
        </div>
      ) : null}

      <div className="mb-6 overflow-hidden rounded-2xl border border-tc-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {orgMeta?.name ?? "Organization"}
              </h1>
              <p className="mt-1 font-mono text-sm text-slate-400">
                /{orgMeta?.slug ?? "…"} · {orgMeta?.status ?? "loading"}
              </p>
              <p className="mt-2 max-w-xl text-sm text-slate-300">
                Manage members, review join requests, send invitations, and configure your trust
                workspace.
              </p>
            </div>
          </div>
        </div>
      </div>

      <nav className="mb-6 flex flex-wrap gap-1 rounded-2xl border border-tc-border bg-tc-surface p-1.5 shadow-soft">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to || "."}
            end={tab.end}
            className={({ isActive }) =>
              [
                "relative rounded-xl px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-emerald-600 text-white shadow-soft"
                  : "text-tc-muted hover:bg-tc-surface-2 hover:text-tc-fg",
              ].join(" ")
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </>
  );
}
