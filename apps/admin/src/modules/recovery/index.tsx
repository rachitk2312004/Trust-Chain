import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function RecoveryPage() {
  return (
    <ModulePage
      module={{
        id: "recovery",
        title: "Recovery",
        description: "Backup, snapshot, and restoration plan metadata (no auto-restore).",
        metrics: [
          { label: "Backups (7d)", value: "14" },
          { label: "Snapshots", value: "6" },
          { label: "Validation Pass Rate", value: "100%" },
          { label: "Restore Plans", value: "2" },
        ],
        items: placeholderItems("Recovery artifact", 4),
      }}
    />
  );
}

export const recoveryModule = { id: "recovery", title: "Recovery" };
