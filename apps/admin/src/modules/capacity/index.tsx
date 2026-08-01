import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function CapacityPage() {
  return (
    <ModulePage
      module={{
        id: "capacity",
        title: "Capacity",
        description: "Storage, compute, network usage and forecasting stubs.",
        metrics: [
          { label: "Storage Used", value: "68%" },
          { label: "CPU Avg", value: "42%" },
          { label: "Network Egress", value: "1.2 Gbps" },
          { label: "Forecast (7d)", value: "+12%" },
        ],
        items: placeholderItems("Capacity signal", 4),
      }}
    />
  );
}

export const capacityModule = { id: "capacity", title: "Capacity" };
