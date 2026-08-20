import { Badge, Button, Card, FormError, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { useRevokeSession, useSessions } from "../features/auth/hooks";
import { getApiErrorMessage } from "../lib/apiErrors";
import type { SessionRow } from "../types/api";

export function SessionsPage() {
  const sessions = useSessions();
  const revoke = useRevokeSession();

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Active sign-ins for your account (GET /api/v1/auth/sessions)."
      />
      {sessions.isError ? <FormError>{getApiErrorMessage(sessions.error)}</FormError> : null}
      {sessions.isLoading ? (
        <Card>Loading sessions…</Card>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Created</TH>
              <TH>IP</TH>
              <TH>Device</TH>
              <TH>Expires</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {(sessions.data ?? []).map((session: SessionRow) => (
              <TR key={session.id}>
                <TD>{new Date(session.createdAt).toLocaleString()}</TD>
                <TD>{session.ip ?? "—"}</TD>
                <TD>
                  <div className="max-w-xs truncate" title={session.userAgent ?? undefined}>
                    {session.userAgent ?? "—"}
                  </div>
                  {session.current ? (
                    <Badge tone="success" className="mt-1">
                      Current
                    </Badge>
                  ) : null}
                </TD>
                <TD>{new Date(session.expiresAt).toLocaleString()}</TD>
                <TD>
                  {!session.current ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(session.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {revoke.isError ? <FormError>{getApiErrorMessage(revoke.error)}</FormError> : null}
    </>
  );
}
