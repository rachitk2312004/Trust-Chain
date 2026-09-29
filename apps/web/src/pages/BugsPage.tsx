import { FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { BugInbox } from "../features/support/BugInbox";
import { usePermissions } from "../hooks/usePermissions";

export function BugsPage() {
  const { canReportBugs, isSuperAdmin, organizationId } = usePermissions();

  if (isSuperAdmin) {
    return (
      <>
        <PageHeader title="Bug reports" />
        <FormHint>Super admins review reports from the admin console.</FormHint>
      </>
    );
  }

  if (!canReportBugs) {
    return (
      <>
        <PageHeader title="Report a bug" />
        <FormHint>Sign in to file a bug report.</FormHint>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Report a bug"
        description="Describe the problem and attach a screenshot. You will see acknowledgements and fix notes here."
      />
      <BugInbox isSuperAdmin={false} canCreate organizationId={organizationId} />
    </>
  );
}
