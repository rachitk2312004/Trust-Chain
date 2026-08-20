import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { isCertificateHolderOnly } from "../lib/workspacePersona";
import { useSessionStore } from "../lib/sessionStore";
import {
  WalletSyncCard,
  WalletTable,
  WalletVerificationDialog,
  useLinkWallet,
  usePatchWallet,
  useSyncWallets,
  useVerifyWallet,
  useWallets,
} from "../features/wallets";
import type { LinkedWallet, WalletChallenge } from "../services/walletApi";

function WalletDashboardEmpty() {
  const { roles, organizationId: scopedOrgId } = usePermissions();
  const holderOnly = isCertificateHolderOnly(roles, scopedOrgId);

  return (
    <>
      <PageHeader title="Wallets" description="Link and verify blockchain wallets." />
      <FormHint>
        {holderOnly ? (
          <>
            Join an organization first using <strong>Join org</strong> in the top bar. Wallet linking
            becomes available once you belong to an organization.
          </>
        ) : (
          <>
            Select an organization in the switcher, or{" "}
            <Link to="/organizations" className="text-[var(--tc-accent)] hover:underline">
              browse organizations
            </Link>
            .
          </>
        )}
      </FormHint>
    </>
  );
}

function WalletDashboardContent({ organizationId }: { organizationId: string }) {
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canSync = isOrgAdmin || isSuperAdmin;

  const wallets = useWallets(organizationId, true);
  const link = useLinkWallet();
  const verify = useVerifyWallet();
  const patch = usePatchWallet();
  const sync = useSyncWallets();

  const [provider, setProvider] = useState("metamask");
  const [address, setAddress] = useState("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12");
  const [label, setLabel] = useState("Primary MetaMask");
  const [message, setMessage] = useState<string | null>(null);
  const [verifyWallet, setVerifyWallet] = useState<LinkedWallet | null>(null);
  const [challenge, setChallenge] = useState<WalletChallenge | null>(null);

  const requestChallenge = useCallback(() => {
    if (!verifyWallet) return;
    verify.mutate(
      { organizationId, walletLinkId: verifyWallet.id },
      {
        onSuccess: (data) => {
          if (data.challenge) setChallenge(data.challenge);
        },
      },
    );
  }, [organizationId, verifyWallet, verify]);

  return (
    <>
      <PageHeader
        title="Wallet sync"
        description="Link MetaMask, Coinbase, WalletConnect, or Phantom and verify ownership."
        actions={
          <Link to="/wallets/history" className="text-sm text-[var(--tc-accent)] hover:underline">
            Ownership history
          </Link>
        }
      />

      {wallets.isError ? <FormError>{getApiErrorMessage(wallets.error)}</FormError> : null}
      {link.isError ? <FormError>{getApiErrorMessage(link.error)}</FormError> : null}
      {verify.isError ? <FormError>{getApiErrorMessage(verify.error)}</FormError> : null}
      {sync.isError ? <FormError>{getApiErrorMessage(sync.error)}</FormError> : null}
      {message ? <FormHint>{message}</FormHint> : null}

      {wallets.isLoading || !wallets.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading wallets…</p>
      ) : (
        <div className="space-y-10">
          <section>
            <WalletSyncCard
              report={wallets.data.report}
              recentSyncJobs={wallets.data.recentSyncJobs}
              canSync={canSync}
              syncPending={sync.isPending}
              onSync={() => {
                sync.mutate(
                  { organizationId, force: true },
                  {
                    onSuccess: (data) => {
                      setMessage(
                        `Sync complete · ${data.job.result.synced} synced · ${data.job.result.skipped} skipped`,
                      );
                    },
                  },
                );
              }}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Link wallet
            </h2>
            <form
              className="grid gap-3 rounded border border-[var(--tc-border)] p-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                link.mutate(
                  {
                    organizationId,
                    provider,
                    address,
                    label,
                    setPrimary: wallets.data.wallets.length === 0,
                  },
                  {
                    onSuccess: (data) => {
                      setMessage(`Linked ${data.wallet.provider} · challenge issued`);
                      setVerifyWallet(data.wallet);
                      setChallenge(data.challenge);
                    },
                  },
                );
              }}
            >
              <div>
                <Label htmlFor="w-provider">Provider</Label>
                <Input
                  id="w-provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  required
                />
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor="w-address">Address</Label>
                <Input
                  id="w-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="w-label">Label</Label>
                <Input id="w-label" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={link.isPending}>
                  {link.isPending ? "Linking…" : "Link wallet"}
                </Button>
              </div>
            </form>
            <p className="mt-2 text-xs text-[var(--tc-muted)]">
              Providers: metamask · coinbase · walletconnect · phantom
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Linked wallets
            </h2>
            <WalletTable
              wallets={wallets.data.wallets}
              onVerify={(w) => {
                setVerifyWallet(w);
                setChallenge(null);
              }}
              onSetPrimary={(w) => {
                patch.mutate(
                  { id: w.id, body: { isPrimary: true } },
                  { onSuccess: () => setMessage("Primary wallet updated") },
                );
              }}
              onRevoke={(w) => {
                patch.mutate(
                  { id: w.id, body: { status: "revoked" } },
                  { onSuccess: () => setMessage("Wallet revoked") },
                );
              }}
            />
          </section>
        </div>
      )}

      <WalletVerificationDialog
        open={Boolean(verifyWallet)}
        onClose={() => {
          setVerifyWallet(null);
          setChallenge(null);
        }}
        wallet={verifyWallet}
        challenge={challenge}
        pending={verify.isPending}
        onRequestChallenge={requestChallenge}
        onSubmitProof={({ challengeId, proof }) => {
          if (!verifyWallet) return;
          verify.mutate(
            {
              organizationId,
              walletLinkId: verifyWallet.id,
              challengeId,
              proof,
            },
            {
              onSuccess: (data) => {
                if (data.verified) {
                  setMessage("Wallet ownership verified");
                  setVerifyWallet(null);
                  setChallenge(null);
                }
              },
            },
          );
        }}
      />
    </>
  );
}

export function WalletDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);

  if (!organizationId) {
    return <WalletDashboardEmpty />;
  }

  return <WalletDashboardContent organizationId={organizationId} />;
}
