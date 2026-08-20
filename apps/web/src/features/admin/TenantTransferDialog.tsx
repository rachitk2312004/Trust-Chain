import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Button, FormError, FormHint, Input, Modal, Textarea } from "@trustchain/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import { useAdminUsers, useTransferAdminTenant } from "./hooks";

export function TenantTransferDialog({
  open,
  onClose,
  tenantId,
  tenantName,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
}) {
  const feedback = useFeedback();
  const transfer = useTransferAdminTenant();
  const [ownerEmail, setOwnerEmail] = useState("");
  const [toParentOrganizationId, setToParentOrganizationId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setOwnerEmail("");
      setToParentOrganizationId("");
      setReason("");
    }
  }, [open]);

  const ownerLookup = useAdminUsers(
    { search: ownerEmail.trim().toLowerCase(), limit: 8 },
    open && ownerEmail.includes("@"),
  );

  const ownerMatch = useMemo(() => {
    const email = ownerEmail.trim().toLowerCase();
    if (!email.includes("@")) return null;
    return (ownerLookup.data?.users ?? []).find((u) => u.email.toLowerCase() === email) ?? null;
  }, [ownerEmail, ownerLookup.data?.users]);

  function handleTransfer() {
    if (!ownerMatch) {
      feedback.error(
        new Error("User not found"),
        "No account for that email. Ask them to register first, then try again.",
      );
      return;
    }

    const parentId = toParentOrganizationId.trim();
    transfer.mutate(
      {
        tenantId,
        toUserId: ownerMatch.id,
        ...(parentId ? { toParentOrganizationId: parentId } : {}),
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          feedback.success("Tenant transferred", `${ownerMatch.email} is now the organization admin.`);
          onClose();
        },
        onError: (err) => feedback.error(err, "Transfer failed"),
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Transfer tenant">
      <FormHint>
        Assign <strong>{tenantName}</strong> to a new organization admin. The tenant stays{" "}
        <code>active</code> — only org admin access changes.
      </FormHint>
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="transfer-owner-email">
            New org admin email
          </label>
          <Input
            id="transfer-owner-email"
            type="email"
            autoFocus
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="admin@customer.com"
          />
          {ownerEmail.includes("@") && !ownerLookup.isLoading ? (
            ownerMatch ? (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Account found — {[ownerMatch.firstName, ownerMatch.lastName].filter(Boolean).join(" ") || ownerMatch.email}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                No account yet.{" "}
                <Link to="/register" className="underline">
                  Register
                </Link>{" "}
                or check{" "}
                <Link to="/admin/users" className="underline">
                  Admin → Users
                </Link>
                .
              </p>
            )
          ) : null}
        </div>
        <details className="rounded-lg border border-tc-border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-tc-muted">Advanced (optional)</summary>
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium">
              New parent organization ID
            </label>
            <Input
              value={toParentOrganizationId}
              onChange={(e) => setToParentOrganizationId(e.target.value)}
              placeholder="Leave blank for top-level tenant"
            />
          </div>
        </details>
        <div>
          <label className="mb-1 block text-sm font-medium">Reason (optional)</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={transfer.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!ownerMatch || transfer.isPending}
            onClick={handleTransfer}
          >
            {transfer.isPending ? "Transferring…" : "Transfer ownership"}
          </Button>
        </div>
        <FormError>{transfer.error ? getApiErrorMessage(transfer.error) : null}</FormError>
      </div>
    </Modal>
  );
}
