import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function SettingsPage() {
  return (
    <ModulePage
      module={{
        id: "settings",
        title: "Settings",
        description: "Admin configuration placeholders.",
        metrics: [
          { label: "Org Members", value: "12" },
          { label: "API Keys", value: "5" },
          { label: "Integrations", value: "4" },
          { label: "Notifications", value: "On" },
        ],
        items: placeholderItems("Setting", 4),
      }}
    />
  );
}

export const settingsModule = { id: "settings", title: "Settings" };
