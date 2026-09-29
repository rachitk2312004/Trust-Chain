import { FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { InquiryInbox } from "../features/support/InquiryInbox";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { usePermissions } from "../hooks/usePermissions";

export function AdminInboxPage() {
  const { isSuperAdmin } = usePermissions();

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Queries" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Queries"
        description="Private inbox between platform administration and organization admins."
      />
      <InquiryInbox canCreate={false} />
    </AdminShellLayout>
  );
}
