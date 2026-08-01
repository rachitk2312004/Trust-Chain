import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function AlertsPage() {
  return (
    <ModulePage
      module={{
        id: "alerts",
        title: "Alerts",
        description: "Severity-ranked alert drafts (no auto-remediation).",
        metrics: [
          { label: "Critical", value: "1" },
          { label: "High", value: "4" },
          { label: "Medium", value: "7" },
          { label: "Info", value: "12" },
        ],
        items: placeholderItems("Alert draft", 4),
      }}
    />
  );
}

export const alertsModule = { id: "alerts", title: "Alerts" };
