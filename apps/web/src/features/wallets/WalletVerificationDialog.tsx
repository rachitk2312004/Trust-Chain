import { useEffect, useState } from "react";
import { Button, FormHint, Input, Label, Modal } from "@trustchain/ui";
import type { LinkedWallet, WalletChallenge } from "../../services/walletApi";

export function WalletVerificationDialog({
  open,
  onClose,
  wallet,
  challenge,
  pending,
  onRequestChallenge,
  onSubmitProof,
}: {
  open: boolean;
  onClose: () => void;
  wallet: LinkedWallet | null;
  challenge: WalletChallenge | null;
  pending?: boolean;
  onRequestChallenge: () => void;
  onSubmitProof: (input: { challengeId: string; proof: string }) => void;
}) {
  const [proof, setProof] = useState("");

  useEffect(() => {
    if (open && !challenge && wallet) {
      onRequestChallenge();
    }
  }, [open, challenge, wallet, onRequestChallenge]);

  return (
    <Modal open={open} title="Verify wallet ownership" onClose={onClose}>
      {!wallet ? (
        <FormHint>Select a wallet first.</FormHint>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!challenge) return;
            onSubmitProof({ challengeId: challenge.id, proof });
          }}
        >
          <FormHint>
            Foundation verification uses sha256(message) as proof (not on-chain EIP-191).
          </FormHint>
          <div>
            <Label>Address</Label>
            <p className="font-mono text-xs break-all">{wallet.addressNormalized}</p>
          </div>
          {challenge ? (
            <>
              <div>
                <Label>Challenge message</Label>
                <pre className="max-h-40 overflow-auto rounded border border-[var(--tc-border)] p-2 text-xs whitespace-pre-wrap">
                  {challenge.message}
                </pre>
              </div>
              <div>
                <Label htmlFor="wv-proof">Proof (sha256 hex)</Label>
                <Input
                  id="wv-proof"
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-[var(--tc-muted)]">
                Hint: {challenge.proofHint} · expires{" "}
                {new Date(challenge.expiresAt).toLocaleString()}
              </p>
            </>
          ) : (
            <FormHint>Requesting challenge…</FormHint>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !challenge}>
              {pending ? "Verifying…" : "Verify"}
            </Button>
            <Button type="button" variant="ghost" onClick={onRequestChallenge} disabled={pending}>
              New challenge
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
