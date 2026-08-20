import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  FraudAlertPanel,
  LeaderboardCard,
  ReputationHistoryPanel,
  ReputationTable,
  usePatchReputation,
  useReputationAlerts,
  useReputationHistory,
  useReputationLeaderboard,
  useReputationList,
  useScoreReputation,
} from "../features/reputation";

export function ReputationDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const list = useReputationList(organizationId, canManage);
  const history = useReputationHistory(organizationId, canManage);
  const alerts = useReputationAlerts(organizationId, canManage);
  const leaderboard = useReputationLeaderboard(organizationId, undefined, canManage);
  const score = useScoreReputation();
  const patch = usePatchReputation();

  const [subjectType, setSubjectType] = useState("user");
  const [subjectId, setSubjectId] = useState("demo-user-1");
  const [label, setLabel] = useState("Demo User");
  const [verificationRate, setVerificationRate] = useState("0.85");
  const [activityVolume, setActivityVolume] = useState("0.6");
  const [peerRating, setPeerRating] = useState("0.75");
  const [longevity, setLongevity] = useState("0.5");
  const [incidentRate, setIncidentRate] = useState("0.1");
  const [scoreVelocity, setScoreVelocity] = useState("0.1");
  const [message, setMessage] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Reputation" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Reputation" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Reputation"
        description="Trust scoring, contribution reputation, fraud alerts, and historical trends."
        actions={
          <Link
            to="/reputation/leaderboard"
            className="text-sm text-[var(--tc-accent)] hover:underline"
          >
            Leaderboard
          </Link>
        }
      />

      {list.isError ? <FormError>{getApiErrorMessage(list.error)}</FormError> : null}
      {score.isError ? <FormError>{getApiErrorMessage(score.error)}</FormError> : null}
      {message ? <FormHint>{message}</FormHint> : null}

      {list.isLoading || !list.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading reputation…</p>
      ) : (
        <div className="space-y-10">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-[var(--tc-border)] p-3">
              <div className="text-xs text-[var(--tc-muted)]">Profiles</div>
              <div className="font-mono text-lg">{list.data.summary.total}</div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-3">
              <div className="text-xs text-[var(--tc-muted)]">Avg overall</div>
              <div className="font-mono text-lg">
                {list.data.summary.averageOverall.toFixed(3)}
              </div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-3">
              <div className="text-xs text-[var(--tc-muted)]">Flagged</div>
              <div className="font-mono text-lg">{list.data.summary.flagged}</div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-3">
              <div className="text-xs text-[var(--tc-muted)]">Open alerts</div>
              <div className="font-mono text-lg">{list.data.summary.openAlerts}</div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Score subject
            </h2>
            <form
              className="grid gap-3 rounded border border-[var(--tc-border)] p-4 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                score.mutate(
                  {
                    organizationId,
                    subjectType,
                    subjectId,
                    label,
                    signals: {
                      verificationRate: Number(verificationRate),
                      activityVolume: Number(activityVolume),
                      peerRating: Number(peerRating),
                      longevity: Number(longevity),
                      incidentRate: Number(incidentRate),
                    },
                    fraudSignals: {
                      scoreVelocity: Number(scoreVelocity),
                    },
                    reason: "dashboard_score",
                  },
                  {
                    onSuccess: (res) => {
                      setMessage(
                        `Scored ${res.profile.subjectType}:${res.profile.subjectId} overall ${res.profile.overallScore.toFixed(3)}` +
                          (res.alert ? ` · alert ${res.alert.title}` : ""),
                      );
                    },
                  },
                );
              }}
            >
              <div>
                <Label htmlFor="rep-type">Subject type</Label>
                <Input
                  id="rep-type"
                  value={subjectType}
                  onChange={(e) => setSubjectType(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="rep-sid">Subject ID</Label>
                <Input
                  id="rep-sid"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="rep-label">Label</Label>
                <Input
                  id="rep-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rep-vr">Verification rate</Label>
                <Input
                  id="rep-vr"
                  value={verificationRate}
                  onChange={(e) => setVerificationRate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rep-av">Activity volume</Label>
                <Input
                  id="rep-av"
                  value={activityVolume}
                  onChange={(e) => setActivityVolume(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rep-pr">Peer rating</Label>
                <Input
                  id="rep-pr"
                  value={peerRating}
                  onChange={(e) => setPeerRating(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rep-lon">Longevity</Label>
                <Input
                  id="rep-lon"
                  value={longevity}
                  onChange={(e) => setLongevity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rep-inc">Incident rate</Label>
                <Input
                  id="rep-inc"
                  value={incidentRate}
                  onChange={(e) => setIncidentRate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rep-vel">Fraud velocity</Label>
                <Input
                  id="rep-vel"
                  value={scoreVelocity}
                  onChange={(e) => setScoreVelocity(e.target.value)}
                />
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={score.isPending}>
                  {score.isPending ? "Scoring…" : "Calculate score"}
                </Button>
              </div>
            </form>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Profiles
            </h2>
            <ReputationTable
              profiles={list.data.profiles}
              watchingId={patch.isPending ? patch.variables?.id : null}
              onWatch={(id) => {
                patch.mutate(
                  { id, body: { status: "watched", reason: "manual_watch" } },
                  { onSuccess: () => setMessage("Profile marked watched") },
                );
              }}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Fraud alerts
            </h2>
            {alerts.isLoading || !alerts.data ? (
              <p className="text-sm text-[var(--tc-muted)]">Loading alerts…</p>
            ) : (
              <FraudAlertPanel
                alerts={alerts.data.alerts}
                openCount={alerts.data.counts.open}
                criticalCount={alerts.data.counts.critical}
              />
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              History
            </h2>
            {history.isLoading || !history.data ? (
              <p className="text-sm text-[var(--tc-muted)]">Loading history…</p>
            ) : (
              <ReputationHistoryPanel
                events={history.data.events}
                trend={history.data.trend}
              />
            )}
          </section>

          <section>
            {leaderboard.isLoading || !leaderboard.data ? (
              <p className="text-sm text-[var(--tc-muted)]">Loading leaderboard…</p>
            ) : (
              <LeaderboardCard
                title="Top subjects"
                entries={leaderboard.data.leaderboard.slice(0, 10)}
              />
            )}
          </section>
        </div>
      )}
    </AppShellLayout>
  );
}
