import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function DeploymentPage() {
  return (
    <ModulePage
      module={{
        id: "deployment",
        title: "Deployment",
        description: "Releases, environments, rollbacks, and migration checklists.",
        metrics: [
          { label: "Latest Release", value: "RELEASE-a1b2c3d4" },
          { label: "Environments", value: "3" },
          { label: "Pending Approvals", value: "1" },
          { label: "Migrations Queued", value: "2" },
        ],
        items: placeholderItems("Deployment", 4),
      }}
    />
  );
}

export const deploymentModule = { id: "deployment", title: "Deployment" };
