import { useState } from "react";
import { Link } from "react-router-dom";
import { FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { LeaderboardCard, useReputationLeaderboard } from "../features/reputation";

export function ReputationLeaderboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const [subjectType, setSubjectType] = useState("");

  const leaderboard = useReputationLeaderboard(
    organizationId,
    subjectType || undefined,
    canManage,
  );

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Reputation leaderboard" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Reputation leaderboard" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Reputation leaderboard"
        description="Ranked trust and overall scores across ecosystem subjects."
        actions={
          <Link to="/reputation" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      <div className="mb-6 max-w-xs">
        <Label htmlFor="lb-type">Filter by subject type</Label>
        <Input
          id="lb-type"
          placeholder="user, wallet, connector…"
          value={subjectType}
          onChange={(e) => setSubjectType(e.target.value)}
        />
      </div>

      {leaderboard.isError ? (
        <FormError>{getApiErrorMessage(leaderboard.error)}</FormError>
      ) : null}

      {leaderboard.isLoading || !leaderboard.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading leaderboard…</p>
      ) : (
        <LeaderboardCard
          title={
            leaderboard.data.subjectType
              ? `${leaderboard.data.subjectType} leaderboard`
              : "All subjects"
          }
          entries={leaderboard.data.leaderboard}
        />
      )}
    </AppShellLayout>
  );
}
