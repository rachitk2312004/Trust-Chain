import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { useSessionStore } from "../lib/sessionStore";
import { OwnershipHistoryPanel, useWalletHistory } from "../features/wallets";

export function WalletHistoryPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const history = useWalletHistory(organizationId, Boolean(organizationId));

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Wallet history" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Wallet ownership history"
        description="Link, verify, sync, conflict, and primary-wallet events."
        actions={
          <Link to="/wallets" className="text-sm text-[var(--tc-accent)] hover:underline">
            Wallets
          </Link>
        }
      />

      {history.isError ? <FormError>{getApiErrorMessage(history.error)}</FormError> : null}

      {history.isLoading || !history.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading ownership history…</p>
      ) : (
        <OwnershipHistoryPanel events={history.data.events} report={history.data.report} />
      )}
    </AppShellLayout>
  );
}
