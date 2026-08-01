import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function GovernancePage() {
  return (
    <ModulePage
      module={{
        id: "governance",
        title: "Governance",
        description: "Policy drafts and approval workflows (no auto-enforcement).",
        metrics: [
          { label: "Policy Drafts", value: "6" },
          { label: "Pending Approval", value: "2" },
          { label: "Active Policies", value: "14" },
          { label: "Retention Rules", value: "8" },
        ],
        items: placeholderItems("Policy", 4),
      }}
    />
  );
}

export const governanceModule = { id: "governance", title: "Governance" };
