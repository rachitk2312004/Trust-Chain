import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function BillingPage() {
  return (
    <ModulePage
      module={{
        id: "billing",
        title: "Billing",
        description: "Usage and invoice placeholders (read-only stub).",
        metrics: [
          { label: "MTD Spend", value: "$1,240" },
          { label: "Storage", value: "842 GB" },
          { label: "API Calls", value: "1.2M" },
          { label: "Invoices Due", value: "1" },
        ],
        items: placeholderItems("Invoice line", 3),
      }}
    />
  );
}

export const billingModule = { id: "billing", title: "Billing" };
