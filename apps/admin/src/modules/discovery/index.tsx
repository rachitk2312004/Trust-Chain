import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function DiscoveryPage() {
  return (
    <ModulePage
      module={{
        id: "discovery",
        title: "Discovery",
        description: "Service registry, topology, dependencies, and health.",
        metrics: [
          { label: "Registered Services", value: "18" },
          { label: "Topology Nodes", value: "24" },
          { label: "Dependencies", value: "31" },
          { label: "Degraded Services", value: "1" },
        ],
        items: placeholderItems("Service", 5),
      }}
    />
  );
}

export const discoveryModule = { id: "discovery", title: "Discovery" };
