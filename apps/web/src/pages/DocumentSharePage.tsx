import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Badge,
  Button,
  FormError,
  FormHint,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { DocumentShareDialog } from "../features/documents/DocumentShareDialog";
import { useDocumentShares, useRevokeShare } from "../features/documents/hooks";
import { getDocumentErrorMessage } from "../lib/docErrors";
import { useSessionStore } from "../lib/sessionStore";

function shareStatus(share: {
  expiresAt: string | null;
  revokedAt: string | null;
}): "active" | "revoked" | "expired" {
  if (share.revokedAt) return "revoked";
  if (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

export function DocumentSharePage() {
  const { documentId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const shares = useDocumentShares(organizationId, documentId);
  const revoke = useRevokeShare(organizationId ?? "", documentId);
  const [open, setOpen] = useState(false);

  if (!organizationId) return <FormError>Select an organization first.</FormError>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setOpen(true)}>New share</Button>
      </div>

      {shares.isError ? <FormError>{getDocumentErrorMessage(shares.error)}</FormError> : null}
      {revoke.isError ? <FormError>{getDocumentErrorMessage(revoke.error)}</FormError> : null}

      {shares.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading shares…</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Recipient</TH>
              <TH>Permission</TH>
              <TH>Status</TH>
              <TH>Expires</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {(shares.data ?? []).map((share) => {
              const status = shareStatus(share);
              return (
                <TR key={share.id}>
                  <TD>{share.sharedWithEmail ?? share.sharedWithUserId ?? "—"}</TD>
                  <TD>{share.permission}</TD>
                  <TD>
                    <Badge
                      tone={
                        status === "active" ? "success" : status === "expired" ? "warning" : "danger"
                      }
                    >
                      {status}
                    </Badge>
                  </TD>
                  <TD>
                    {share.expiresAt ? new Date(share.expiresAt).toLocaleString() : "—"}
                  </TD>
                  <TD>
                    {status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(share.id)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      {!shares.isLoading && (shares.data?.length ?? 0) === 0 ? (
        <FormHint>No shares yet.</FormHint>
      ) : null}

      <DocumentShareDialog
        organizationId={organizationId}
        documentId={documentId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
