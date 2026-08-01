import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function FeatureFlagsPage() {
  return (
    <ModulePage
      module={{
        id: "feature-flags",
        title: "Feature Flags",
        description: "Toggle registry placeholders.",
        metrics: [
          { label: "Total Flags", value: "22" },
          { label: "Enabled", value: "15" },
          { label: "Experiments", value: "3" },
          { label: "Overrides", value: "2" },
        ],
        items: placeholderItems("Flag", 4),
      }}
    />
  );
}

export const featureFlagsModule = { id: "feature-flags", title: "Feature Flags" };
