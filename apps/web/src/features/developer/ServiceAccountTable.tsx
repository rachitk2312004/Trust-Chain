import { Badge, Button, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import { useState } from "react";
import type { DeveloperServiceAccount } from "../../types/api";
import { useFeedback } from "../../hooks/useFeedback";
import { usePatchDeveloperServiceAccount } from "./hooks";
import { ServiceAccountDialog } from "./ServiceAccountDialog";

function statusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "suspended") return "warning" as const;
  return "neutral" as const;
}

export function ServiceAccountTable({
  organizationId,
  accounts,
}: {
  organizationId: string;
  accounts: DeveloperServiceAccount[];
}) {
  const feedback = useFeedback();
  const patch = usePatchDeveloperServiceAccount();
  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Create service account
        </Button>
      </div>

      {secret ? (
        <FormHint>
          Secret (copy now): <span className="font-mono text-xs">{secret}</span>
        </FormHint>
      ) : null}

      {accounts.length === 0 ? (
        <FormHint>No service accounts yet.</FormHint>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Code</TH>
              <TH>Status</TH>
              <TH>Rotated</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {accounts.map((account) => (
              <TR key={account.id}>
                <TD>{account.name}</TD>
                <TD className="font-mono text-xs">{account.publicCode}</TD>
                <TD>
                  <Badge tone={statusTone(account.status)}>{account.status}</Badge>
                </TD>
                <TD className="text-xs">
                  {account.lastRotatedAt
                    ? new Date(account.lastRotatedAt).toLocaleString()
                    : "—"}
                </TD>
                <TD>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={patch.isPending}
                      onClick={() =>
                        patch.mutate(
                          {
                            serviceAccountId: account.id,
                            organizationId,
                            body: { rotate: true },
                          },
                          {
                            onSuccess: (data) => {
                              if (data.secret) setSecret(data.secret);
                              feedback.success("Secret rotated");
                            },
                            onError: (err) => feedback.error(err, "Rotate failed"),
                          },
                        )
                      }
                    >
                      Rotate
                    </Button>
                    {account.status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={patch.isPending}
                        onClick={() =>
                          patch.mutate(
                            {
                              serviceAccountId: account.id,
                              organizationId,
                              body: { status: "suspended" },
                            },
                            {
                              onSuccess: () => feedback.success("Suspended"),
                              onError: (err) => feedback.error(err, "Suspend failed"),
                            },
                          )
                        }
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={patch.isPending}
                        onClick={() =>
                          patch.mutate(
                            {
                              serviceAccountId: account.id,
                              organizationId,
                              body: { status: "active" },
                            },
                            {
                              onSuccess: () => feedback.success("Activated"),
                              onError: (err) => feedback.error(err, "Activate failed"),
                            },
                          )
                        }
                      >
                        Activate
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <ServiceAccountDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        organizationId={organizationId}
      />
    </div>
  );
}
