import { useEffect, useState, type ReactNode } from "react";
import { DashboardPage, dashboardModule } from "./modules/dashboard";
import { AnalyticsPage, analyticsModule } from "./modules/analytics";
import { GovernancePage, governanceModule } from "./modules/governance";
import { CompliancePage, complianceModule } from "./modules/compliance";
import { AlertsPage, alertsModule } from "./modules/alerts";
import { ReportsPage, reportsModule } from "./modules/reports";
import { BillingPage, billingModule } from "./modules/billing";
import { HealthPage, healthModule } from "./modules/health";
import { FeatureFlagsPage, featureFlagsModule } from "./modules/feature-flags";
import { InvestigationsPage, investigationsModule } from "./modules/investigations";
import { SettingsPage, settingsModule } from "./modules/settings";
import { DeploymentPage, deploymentModule } from "./modules/deployment";
import { RecoveryPage, recoveryModule } from "./modules/recovery";
import { CapacityPage, capacityModule } from "./modules/capacity";
import { DataPage, dataModule } from "./modules/data";
import { DiscoveryPage, discoveryModule } from "./modules/discovery";
import { SecretsPage, secretsModule } from "./modules/secrets";
import { EventsPage, eventsModule } from "./modules/events";

type NavItem = { id: string; title: string };

const navItems: NavItem[] = [
  dashboardModule,
  analyticsModule,
  governanceModule,
  complianceModule,
  alertsModule,
  reportsModule,
  billingModule,
  healthModule,
  featureFlagsModule,
  investigationsModule,
  settingsModule,
  deploymentModule,
  recoveryModule,
  capacityModule,
  dataModule,
  discoveryModule,
  secretsModule,
  eventsModule,
];

const pages: Record<string, () => ReactNode> = {
  dashboard: DashboardPage,
  analytics: AnalyticsPage,
  governance: GovernancePage,
  compliance: CompliancePage,
  alerts: AlertsPage,
  reports: ReportsPage,
  billing: BillingPage,
  health: HealthPage,
  "feature-flags": FeatureFlagsPage,
  investigations: InvestigationsPage,
  settings: SettingsPage,
  deployment: DeploymentPage,
  recovery: RecoveryPage,
  capacity: CapacityPage,
  data: DataPage,
  discovery: DiscoveryPage,
  secrets: SecretsPage,
  events: EventsPage,
};

function routeFromHash(): string {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return hash || "dashboard";
}

export function App() {
  const [activeRoute, setActiveRoute] = useState(routeFromHash);

  useEffect(() => {
    const onHashChange = () => setActiveRoute(routeFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const ActivePage = pages[activeRoute] ?? DashboardPage;

  return (
    <div className="flex min-h-screen">
      <nav className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <h1 className="mb-4 text-lg font-semibold text-slate-900">TrustChain Admin</h1>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              <a
                href={`#/${item.id}`}
                className={`block rounded px-2 py-1.5 text-sm ${
                  activeRoute === item.id
                    ? "bg-indigo-50 font-medium text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-1 p-6">
        <ActivePage />
      </main>
    </div>
  );
}
