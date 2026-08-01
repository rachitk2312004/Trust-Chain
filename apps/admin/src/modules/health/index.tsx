import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function HealthPage() {
  return (
    <ModulePage
      module={{
        id: "health",
        title: "Health",
        description: "Platform health snapshots and component status.",
        metrics: [
          { label: "Overall", value: "Degraded" },
          { label: "API", value: "Up" },
          { label: "Database", value: "Up" },
          { label: "Storage", value: "Degraded" },
        ],
        items: placeholderItems("Health check", 4),
      }}
    />
  );
}

export const healthModule = { id: "health", title: "Health" };
