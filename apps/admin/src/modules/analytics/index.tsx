import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function AnalyticsPage() {
  return (
    <ModulePage
      module={{
        id: "analytics",
        title: "Analytics",
        description: "Metrics aggregation and anomaly detection stubs.",
        metrics: [
          { label: "Metrics Tracked", value: "24" },
          { label: "Anomalies (24h)", value: "3" },
          { label: "Avg Latency", value: "142ms" },
          { label: "Error Rate", value: "0.4%" },
        ],
        items: placeholderItems("Metric series", 4),
      }}
    />
  );
}

export const analyticsModule = { id: "analytics", title: "Analytics" };
