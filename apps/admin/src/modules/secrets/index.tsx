import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function SecretsPage() {
  return (
    <ModulePage
      module={{
        id: "secrets",
        title: "Secrets",
        description: "Rotation schedules, ref validation, and audit events (refs only).",
        metrics: [
          { label: "Managed Refs", value: "16" },
          { label: "Due Rotation", value: "2" },
          { label: "Audit Events (24h)", value: "34" },
          { label: "Access Denials", value: "0" },
        ],
        items: placeholderItems("Secret ref", 4),
      }}
    />
  );
}

export const secretsModule = { id: "secrets", title: "Secrets" };
