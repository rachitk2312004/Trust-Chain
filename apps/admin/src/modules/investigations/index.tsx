import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function InvestigationsPage() {
  return (
    <ModulePage
      module={{
        id: "investigations",
        title: "Investigations",
        description: "Incident and audit investigation stubs.",
        metrics: [
          { label: "Open Cases", value: "3" },
          { label: "Escalated", value: "1" },
          { label: "Resolved (30d)", value: "9" },
          { label: "Avg Resolution", value: "18h" },
        ],
        items: placeholderItems("Investigation", 4),
      }}
    />
  );
}

export const investigationsModule = { id: "investigations", title: "Investigations" };
