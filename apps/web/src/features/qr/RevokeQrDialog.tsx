import { Button, FormError, Modal } from "@trustchain/ui";
import { useRevokeQr } from "./hooks";
import { getQrErrorMessage } from "../../lib/qrErrors";

export function RevokeQrDialog({
  organizationId,
  publicCode,
  open,
  onClose,
  onRevoked,
}: {
  organizationId: string;
  publicCode: string;
  open: boolean;
  onClose: () => void;
  onRevoked?: () => void;
}) {
  const revoke = useRevokeQr(organizationId);

  return (
    <Modal
      open={open}
      title="Revoke QR code"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={revoke.isPending}
            onClick={() =>
              revoke.mutate(publicCode, {
                onSuccess: () => {
                  onClose();
                  onRevoked?.();
                },
              })
            }
          >
            {revoke.isPending ? "Revoking…" : "Revoke"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--tc-fg)]">
        Revoke <strong>{publicCode}</strong>? Scans will fail after revocation.
      </p>
      <FormError>{revoke.error ? getQrErrorMessage(revoke.error) : null}</FormError>
    </Modal>
  );
}
