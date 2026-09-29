import { FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { BugInbox } from "../features/support/BugInbox";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { usePermissions } from "../hooks/usePermissions";

export function AdminBugsPage() {
  const { isSuperAdmin } = usePermissions();

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Bug reports" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Bug reports"
        description="Review screenshots and descriptions, then acknowledge or mark a fix."
      />
      <BugInbox isSuperAdmin canCreate={false} />
    </AdminShellLayout>
  );
}
