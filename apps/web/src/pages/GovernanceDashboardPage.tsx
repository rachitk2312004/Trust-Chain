import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  ControlAssessmentPanel,
  ExecutiveDashboardCard,
  GovernancePolicyTable,
  RiskRegisterTable,
  useCreateGovernancePolicy,
  useCreateGovernanceRisk,
  useGovernanceDashboard,
  usePatchGovernancePolicy,
} from "../features/governance";

export function GovernanceDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const dashboard = useGovernanceDashboard(organizationId, canManage);
  const createPolicy = useCreateGovernancePolicy();
  const patchPolicy = usePatchGovernancePolicy();
  const createRisk = useCreateGovernanceRisk();

  const [policyKey, setPolicyKey] = useState("info-sec-policy");
  const [policyTitle, setPolicyTitle] = useState("Information Security Policy");
  const [policyFramework, setPolicyFramework] = useState("iso27001");
  const [riskKey, setRiskKey] = useState("data-breach");
  const [riskTitle, setRiskTitle] = useState("Unauthorized data disclosure");
  const [riskCategory, setRiskCategory] = useState("confidentiality");
  const [likelihood, setLikelihood] = useState("4");
  const [impact, setImpact] = useState("5");
  const [mitigation, setMitigation] = useState("0.4");
  const [message, setMessage] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Governance" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Governance" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const data = dashboard.data;

  return (
    <AppShellLayout>
      <PageHeader
        title="Governance"
        description="Frameworks, policies, risk register, control assessments, and executive posture."
        actions={
          <Link
            to="/governance/reports"
            className="text-sm text-[var(--tc-accent)] hover:underline"
          >
            Executive reports
          </Link>
        }
      />

      {dashboard.isError ? <FormError>{getApiErrorMessage(dashboard.error)}</FormError> : null}
      {createPolicy.isError ? (
        <FormError>{getApiErrorMessage(createPolicy.error)}</FormError>
      ) : null}
      {createRisk.isError ? <FormError>{getApiErrorMessage(createRisk.error)}</FormError> : null}
      {message ? <FormHint>{message}</FormHint> : null}

      {dashboard.isLoading || !data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading governance…</p>
      ) : (
        <div className="space-y-10">
          <section>
            <ExecutiveDashboardCard
              executive={data.executive}
              riskPortfolio={data.riskPortfolio}
              frameworksEnabled={data.frameworks.filter((f) => f.enabled).length}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Frameworks
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.frameworks.map((f) => (
                <div key={f.id} className="rounded border border-[var(--tc-border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{f.name}</span>
                    <span className="text-xs text-[var(--tc-muted)]">{f.version}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--tc-muted)]">{f.description}</p>
                  <p className="mt-2 font-mono text-xs">
                    {f.controlCount} controls · {f.enabled ? "in use" : "available"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Create policy
            </h2>
            <form
              className="grid gap-3 rounded border border-[var(--tc-border)] p-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                createPolicy.mutate(
                  {
                    organizationId,
                    key: policyKey,
                    title: policyTitle,
                    framework: policyFramework,
                    status: "active",
                  },
                  {
                    onSuccess: (res) => {
                      setMessage(`Policy ${res.policy.key} created`);
                    },
                  },
                );
              }}
            >
              <div>
                <Label htmlFor="gp-key">Key</Label>
                <Input
                  id="gp-key"
                  value={policyKey}
                  onChange={(e) => setPolicyKey(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="gp-title">Title</Label>
                <Input
                  id="gp-title"
                  value={policyTitle}
                  onChange={(e) => setPolicyTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="gp-fw">Framework</Label>
                <Input
                  id="gp-fw"
                  value={policyFramework}
                  onChange={(e) => setPolicyFramework(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createPolicy.isPending}>
                  {createPolicy.isPending ? "Saving…" : "Add policy"}
                </Button>
              </div>
            </form>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Policies
            </h2>
            <GovernancePolicyTable
              policies={data.policies}
              activatingId={patchPolicy.isPending ? patchPolicy.variables?.id : null}
              onActivate={(id) => {
                patchPolicy.mutate(
                  { id, body: { status: "active" } },
                  { onSuccess: () => setMessage("Policy activated") },
                );
              }}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Register risk
            </h2>
            <form
              className="grid gap-3 rounded border border-[var(--tc-border)] p-4 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                createRisk.mutate(
                  {
                    organizationId,
                    key: riskKey,
                    title: riskTitle,
                    category: riskCategory,
                    framework: policyFramework,
                    likelihood: Number(likelihood),
                    impact: Number(impact),
                    mitigationEffectiveness: Number(mitigation),
                    controlKeys: ["iso27001.risk_assessment", "soc2.access_control"],
                  },
                  {
                    onSuccess: (res) => {
                      setMessage(
                        `Risk ${res.risk.key} scored residual ${res.risk.residualScore} (${res.risk.band})`,
                      );
                    },
                  },
                );
              }}
            >
              <div>
                <Label htmlFor="gr-key">Key</Label>
                <Input
                  id="gr-key"
                  value={riskKey}
                  onChange={(e) => setRiskKey(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="gr-title">Title</Label>
                <Input
                  id="gr-title"
                  value={riskTitle}
                  onChange={(e) => setRiskTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="gr-cat">Category</Label>
                <Input
                  id="gr-cat"
                  value={riskCategory}
                  onChange={(e) => setRiskCategory(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="gr-l">Likelihood (1–5)</Label>
                <Input
                  id="gr-l"
                  value={likelihood}
                  onChange={(e) => setLikelihood(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="gr-i">Impact (1–5)</Label>
                <Input
                  id="gr-i"
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="gr-m">Mitigation (0–1)</Label>
                <Input
                  id="gr-m"
                  value={mitigation}
                  onChange={(e) => setMitigation(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={createRisk.isPending}>
                  {createRisk.isPending ? "Scoring…" : "Add risk"}
                </Button>
              </div>
            </form>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Risk register
            </h2>
            <RiskRegisterTable risks={data.risks} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Control assessments
            </h2>
            <ControlAssessmentPanel
              evaluations={data.controlLibrary.evaluations}
              assessments={data.assessments}
              coverageScore={data.controlLibrary.coverageScore}
            />
          </section>
        </div>
      )}
    </AppShellLayout>
  );
}
