import { useState } from "react";
import { Button, Field, FormError, Input, Label, Modal } from "@trustchain/ui";
import { getCertificateErrorMessage } from "../../lib/certificateErrors";
import { useRevokeCertificate } from "./hooks";

export function RevokeCertificateDialog({
  organizationId,
  certificateId,
  publicId,
  open,
  onClose,
  onRevoked,
}: {
  organizationId: string;
  certificateId: string;
  publicId: string;
  open: boolean;
  onClose: () => void;
  onRevoked?: () => void;
}) {
  const revoke = useRevokeCertificate(organizationId);
  const [reason, setReason] = useState("");

  function handleClose() {
    setReason("");
    revoke.reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Revoke certificate"
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
                { certificateId, reason: reason.trim() || undefined },
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
        <Label htmlFor="revoke-reason">Reason (optional)</Label>
        <Input
          id="revoke-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Issued in error"
        />
      </Field>
      <FormError>{revoke.error ? getCertificateErrorMessage(revoke.error) : null}</FormError>
    </Modal>
  );
}
