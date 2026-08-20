import { useState } from "react";
import { Button, Field, FormError, Input, Label, Modal } from "@trustchain/ui";
import { getSignatureErrorMessage } from "../../lib/signatureErrors";
import { useRevokeSignature } from "./hooks";

export function RevokeSignatureDialog({
  organizationId,
  signatureId,
  publicId,
  open,
  onClose,
  onRevoked,
}: {
  organizationId: string;
  signatureId: string;
  publicId: string;
  open: boolean;
  onClose: () => void;
  onRevoked?: () => void;
}) {
  const revoke = useRevokeSignature(organizationId);
  const [reason, setReason] = useState("");

  function handleClose() {
    setReason("");
    revoke.reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Revoke signature"
      onClose={handleClose}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={revoke.isPending}
            onClick={() =>
              revoke.mutate(
                { signatureId, reason: reason.trim() || undefined },
                {
                  onSuccess: () => {
                    handleClose();
                    onRevoked?.();
                  },
                },
              )
            }
          >
            {revoke.isPending ? "Revoking…" : "Revoke"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-[var(--tc-fg)]">
        Revoke <strong>{publicId}</strong>? Verification will fail after revocation.
      </p>
      <Field>
        <Label htmlFor="sig-revoke-reason">Reason (optional)</Label>
        <Input
          id="sig-revoke-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Key compromised"
        />
      </Field>
      <FormError>{revoke.error ? getSignatureErrorMessage(revoke.error) : null}</FormError>
    </Modal>
  );
}
