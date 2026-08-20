import { Link } from "react-router-dom";
import {
  Badge,
  FormError,
  FormHint,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { useQrEvents } from "../features/qr/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getQrErrorMessage } from "../lib/qrErrors";
import { useSessionStore } from "../lib/sessionStore";

export function QrHistoryPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const events = useQrEvents(organizationId);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="QR history" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="QR history"
        description="Recent scan and download events for this organization."
        actions={
          <Link to="/qr" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      {events.isError ? <FormError>{getQrErrorMessage(events.error)}</FormError> : null}

      {events.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading events…</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>QR</TH>
              <TH>Type</TH>
              <TH>Outcome</TH>
              <TH>Result</TH>
            </TR>
          </THead>
          <TBody>
            {(events.data ?? []).map((event) => (
              <TR key={event.id}>
                <TD>{new Date(event.createdAt).toLocaleString()}</TD>
                <TD>
                  {event.qrPublicCode ? (
                    <Link
                      to={`/qr/${encodeURIComponent(event.qrPublicCode)}`}
                      className="text-[var(--tc-accent)] hover:underline"
                    >
                      {event.qrPublicCode}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD>{event.lookupType}</TD>
                <TD>{event.outcome ?? event.errorCode ?? "—"}</TD>
                <TD>
                  <Badge tone={event.success ? "success" : "danger"}>
                    {event.success ? "success" : "failed"}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {!events.isLoading && (events.data?.length ?? 0) === 0 ? (
        <FormHint>No QR events recorded yet.</FormHint>
      ) : null}
    </AppShellLayout>
  );
}
