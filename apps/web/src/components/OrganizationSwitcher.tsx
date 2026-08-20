import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Clock } from "lucide-react";
import { Badge, Select } from "@trustchain/ui";
import { JoinOrganizationDialog } from "../features/organizations/JoinOrganizationDialog";
import { useOrganizationWorkspace } from "../features/organizations/hooks";
import { meQueryKey } from "../features/auth/meQuery";
import { usePermissions } from "../hooks/usePermissions";
import { isOrgAdminOnly } from "../lib/homeRoute";
import { canSelfJoinOrganization } from "../lib/workspacePersona";
import { useSessionStore } from "../lib/sessionStore";

function useDeferredTopBarFetch(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setReady(true), { timeout: 400 });
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);
  return ready;
}

export function OrganizationSwitcher() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchReady = useDeferredTopBarFetch();
  const workspace = useOrganizationWorkspace(fetchReady);
  const refetchWorkspace = workspace.refetch;
  const { roles, organizationId, isSuperAdmin } = usePermissions();
  const allowJoin = canSelfJoinOrganization(roles);
  const dedicatedOrgAdmin = isOrgAdminOnly(roles, organizationId);

  if (isSuperAdmin) {
    return null;
  }
  const activeId = useSessionStore((s) => s.activeOrganizationId);
  const setActive = useSessionStore((s) => s.setActiveOrganizationId);
  const [joinOpen, setJoinOpen] = useState(false);
  const approvedRefreshDone = useRef(false);

  const activeOrgs = useMemo(
    () => (workspace.data?.organizations ?? []).filter((o) => o.status === "active"),
    [workspace.data?.organizations],
  );

  const joinRequests = workspace.data?.joinRequests;
  const pendingRequests = useMemo(
    () => (allowJoin ? (joinRequests ?? []).filter((r) => r.status === "pending") : []),
    [allowJoin, joinRequests],
  );

  const singleOrg = dedicatedOrgAdmin && activeOrgs.length === 1 ? activeOrgs[0] : null;

  // Refresh workspace once when a join is first approved — avoid refetch storm on every render.
  useEffect(() => {
    if (!allowJoin || !joinRequests || approvedRefreshDone.current) return;
    const hasApproved = joinRequests.some((r) => r.status === "approved");
    if (!hasApproved) return;
    approvedRefreshDone.current = true;
    void refetchWorkspace();
    void queryClient.invalidateQueries({ queryKey: meQueryKey });
  }, [allowJoin, joinRequests, queryClient, refetchWorkspace]);

  useEffect(() => {
    const orgList = workspace.data?.organizations;
    if (!orgList || orgList.length === 0) return;
    const stillValid = orgList.some((o) => o.id === activeId);
    if (!activeId || !stillValid) {
      const next = activeOrgs[0] ?? orgList[0];
      if (next) setActive(next.id);
    }
  }, [workspace.data?.organizations, activeId, activeOrgs, setActive]);

  const value = activeId ?? "";
  const hasOrgs = activeOrgs.length > 0;

  const emptyLabel = pendingRequests.length
    ? "Awaiting approval…"
    : "No organizations yet";

  if (singleOrg) {
    return (
      <div className="flex h-9 min-w-[10rem] max-w-[16rem] items-center gap-2 rounded-xl border border-tc-border bg-tc-canvas/70 px-3">
        <Building2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <span className="truncate text-sm font-medium text-tc-fg">{singleOrg.name}</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          aria-label="Active organization"
          title={
            !hasOrgs && allowJoin
              ? "Request to join an organization using the Join org button."
              : undefined
          }
          className="h-9 w-[10.5rem] sm:w-[12.5rem]"
          value={value}
          disabled={workspace.isPending && !workspace.data}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) {
              setActive(null);
              navigate("/organizations");
              return;
            }
            setActive(next);
            navigate(`/organizations/${next}`);
          }}
        >
          <option value="">
            {workspace.isPending && !workspace.data
              ? emptyLabel
              : hasOrgs
                ? "Select organization"
                : emptyLabel}
          </option>
          {activeOrgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </Select>

        {allowJoin && pendingRequests.length > 0 ? (
          <Badge
            tone="warning"
            className="hidden h-9 items-center gap-1 px-2.5 text-xs sm:inline-flex"
            title={pendingRequests
              .map((r) => r.organizationName ?? "Organization")
              .join(", ")}
          >
            <Clock className="h-3 w-3 shrink-0" />
            {pendingRequests.length === 1
              ? "Pending"
              : `${pendingRequests.length} pending`}
          </Badge>
        ) : null}

        {allowJoin ? (
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-tc-border bg-tc-surface px-3 text-sm font-medium text-tc-fg transition hover:bg-tc-surface-2"
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Join org</span>
            <span className="sm:hidden">Join</span>
          </button>
        ) : null}
      </div>

      {allowJoin && joinOpen ? (
        <JoinOrganizationDialog
          open={joinOpen}
          onClose={() => setJoinOpen(false)}
          onRequested={() => {
            void refetchWorkspace();
          }}
        />
      ) : null}
    </>
  );
}
