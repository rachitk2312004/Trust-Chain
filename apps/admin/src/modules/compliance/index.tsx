import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function CompliancePage() {
  return (
    <ModulePage
      module={{
        id: "compliance",
        title: "Compliance",
        description: "GDPR, SOC2, and ISO 27001 checklist stubs.",
        metrics: [
          { label: "GDPR Complete", value: "62%" },
          { label: "SOC2 Complete", value: "48%" },
          { label: "ISO 27001 Complete", value: "55%" },
          { label: "Open Gaps", value: "11" },
        ],
        items: placeholderItems("Checklist item", 5),
      }}
    />
  );
}

export const complianceModule = { id: "compliance", title: "Compliance" };
