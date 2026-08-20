import { Badge, Button, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { LinkedWallet } from "../../services/walletApi";

export function WalletTable({
  wallets,
  onVerify,
  onSetPrimary,
  onRevoke,
}: {
  wallets: LinkedWallet[];
  onVerify?: (wallet: LinkedWallet) => void;
  onSetPrimary?: (wallet: LinkedWallet) => void;
  onRevoke?: (wallet: LinkedWallet) => void;
}) {
  if (wallets.length === 0) {
    return <FormHint>No wallets linked yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Wallet</TH>
          <TH>Provider</TH>
          <TH>Status</TH>
          <TH>Primary</TH>
          <TH>Synced</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {wallets.map((w) => (
          <TR key={w.id}>
            <TD>
              <div className="font-medium">{w.label || "Untitled"}</div>
              <div className="max-w-[220px] truncate font-mono text-xs text-[var(--tc-muted)]">
                {w.addressNormalized}
              </div>
            </TD>
            <TD className="font-mono text-xs">{w.provider}</TD>
            <TD>
              <Badge
                tone={
                  w.status === "verified"
                    ? "success"
                    : w.status === "conflict" || w.status === "revoked"
                      ? "danger"
                      : "neutral"
                }
              >
                {w.status}
              </Badge>
            </TD>
            <TD className="text-xs">{w.isPrimary ? "yes" : "—"}</TD>
            <TD className="text-xs">
              {w.lastSyncedAt ? new Date(w.lastSyncedAt).toLocaleString() : "—"}
            </TD>
            <TD>
              <div className="flex flex-wrap gap-1">
                {onVerify && w.status === "pending" ? (
                  <Button type="button" variant="ghost" onClick={() => onVerify(w)}>
                    Verify
                  </Button>
                ) : null}
                {onSetPrimary && !w.isPrimary && w.status !== "revoked" ? (
                  <Button type="button" variant="ghost" onClick={() => onSetPrimary(w)}>
                    Primary
                  </Button>
                ) : null}
                {onRevoke && w.status !== "revoked" ? (
                  <Button type="button" variant="ghost" onClick={() => onRevoke(w)}>
                    Revoke
                  </Button>
                ) : null}
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
