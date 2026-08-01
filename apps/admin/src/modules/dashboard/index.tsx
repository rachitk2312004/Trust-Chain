import { ModulePage, ScoreCard, placeholderItems } from "../../components/ModulePage";

const platformScores = {
  trustScore: 0.87,
  healthScore: 0.92,
  riskScore: 0.18,
  complianceScore: 0.76,
};

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Operations Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          Wave 10 operational intelligence overview (stub metrics).
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreCard label="Trust Score" value={platformScores.trustScore} />
        <ScoreCard label="Health Score" value={platformScores.healthScore} />
        <ScoreCard label="Risk Score" value={platformScores.riskScore} />
        <ScoreCard label="Compliance Score" value={platformScores.complianceScore} />
      </div>

      <ModulePage
        module={{
          id: "dashboard",
          title: "Recent Activity",
          description: "Placeholder operational feed.",
          metrics: [
            { label: "Open Alerts", value: "12" },
            { label: "Pending Approvals", value: "4" },
            { label: "Active Deployments", value: "2" },
            { label: "Services Registered", value: "18" },
          ],
          items: placeholderItems("Activity", 5),
        }}
      />
    </div>
  );
}

export const dashboardModule = { id: "dashboard", title: "Dashboard" };
