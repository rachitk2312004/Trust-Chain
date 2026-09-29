import { FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { InquiryInbox } from "../features/support/InquiryInbox";
import { usePermissions } from "../hooks/usePermissions";

export function SupportInboxPage() {
  const { canUsePlatformQueries, organizationId } = usePermissions();

  if (!canUsePlatformQueries) {
    return (
      <>
        <PageHeader title="Platform queries" />
        <FormHint>Only organization admins can message platform administration.</FormHint>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Platform queries"
        description="Ask the super admin about tenancy, access, or platform configuration."
      />
      <InquiryInbox canCreate organizationId={organizationId} />
    </>
  );
}
