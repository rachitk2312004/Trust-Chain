import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function DataPage() {
  return (
    <ModulePage
      module={{
        id: "data",
        title: "Data",
        description: "Classification, lineage, retention, and catalog stubs.",
        metrics: [
          { label: "Catalog Entries", value: "47" },
          { label: "Confidential Assets", value: "12" },
          { label: "Lineage Graphs", value: "8" },
          { label: "Retention Policies", value: "6" },
        ],
        items: placeholderItems("Dataset", 4),
      }}
    />
  );
}

export const dataModule = { id: "data", title: "Data" };
