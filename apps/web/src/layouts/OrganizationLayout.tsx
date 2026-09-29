import { Outlet, useParams } from "react-router-dom";
import { Building2 } from "lucide-react";
import { FormError } from "@trustchain/ui";
import { useEffect } from "react";
import { useOrganization } from "../features/organizations/hooks";
import { getOrganizationErrorMessage, isOrgNotFound } from "../lib/orgErrors";
import { useSessionStore } from "../lib/sessionStore";

export function OrganizationLayout() {
  const { organizationId = "" } = useParams();
  const org = useOrganization(organizationId);
  const setActive = useSessionStore((s) => s.setActiveOrganizationId);

  useEffect(() => {
    if (organizationId) setActive(organizationId);
  }, [organizationId, setActive]);

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
                Review join requests, manage members, and organize your workspace by branch and
                department.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Outlet />
    </>
  );
}
