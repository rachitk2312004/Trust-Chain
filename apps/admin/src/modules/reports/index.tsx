import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function ReportsPage() {
  return (
    <ModulePage
      module={{
        id: "reports",
        title: "Reports",
        description: "Report summaries and export helpers.",
        metrics: [
          { label: "Scheduled", value: "5" },
          { label: "Generated (7d)", value: "18" },
          { label: "Exports Pending", value: "2" },
          { label: "Last Run", value: "2h ago" },
        ],
        items: placeholderItems("Report", 4),
      }}
    />
  );
}

export const reportsModule = { id: "reports", title: "Reports" };
