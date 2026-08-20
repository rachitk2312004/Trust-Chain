import { useParams } from "react-router-dom";
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
import { useCertificateHistory } from "../features/certificates";
import { getCertificateErrorMessage } from "../lib/certificateErrors";
import { useSessionStore } from "../lib/sessionStore";

function eventTone(eventType: string): "success" | "warning" | "danger" | "neutral" | "info" {
  if (eventType.includes("revoke")) return "danger";
  if (eventType.includes("verify")) return "info";
  if (eventType.includes("issue")) return "success";
  if (eventType.includes("expir")) return "warning";
  return "neutral";
}

export function CertificateHistoryPage() {
  const { certificateId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const history = useCertificateHistory(organizationId, certificateId);

  if (!organizationId) {
    return <FormHint>Select an organization first.</FormHint>;
  }

  if (history.isError) {
    return <FormError>{getCertificateErrorMessage(history.error)}</FormError>;
  }

  if (history.isLoading) {
    return <p className="text-sm text-[var(--tc-muted)]">Loading history…</p>;
  }

  const events = history.data?.events ?? [];

  if (events.length === 0) {
    return <FormHint>No events recorded for this certificate yet.</FormHint>;
  }

  return (
    <div className="relative">
      <div className="mb-4 space-y-3">
        {events.map((event, index) => (
          <div
            key={event.id}
            className="relative rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] p-4"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={eventTone(event.eventType)}>{event.eventType}</Badge>
              <span className="text-xs text-[var(--tc-muted)]">
                {new Date(event.createdAt).toLocaleString()}
              </span>
              {index === 0 ? <Badge tone="info">latest</Badge> : null}
            </div>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-[var(--tc-muted)]">Actor</dt>
              <dd className="font-mono text-xs">{event.actorId ?? "system"}</dd>
              <dt className="text-[var(--tc-muted)]">Payload</dt>
              <dd>
                <pre className="max-h-40 overflow-auto rounded bg-[var(--tc-surface-2)] p-2 text-xs">
                  {JSON.stringify(event.payload ?? {}, null, 2)}
                </pre>
              </dd>
            </dl>
          </div>
        ))}
      </div>

      <Table>
        <THead>
          <TR>
            <TH>When</TH>
            <TH>Event</TH>
            <TH>Actor</TH>
          </TR>
        </THead>
        <TBody>
          {events.map((event) => (
            <TR key={`row-${event.id}`}>
              <TD>{new Date(event.createdAt).toLocaleString()}</TD>
              <TD>
                <Badge tone={eventTone(event.eventType)}>{event.eventType}</Badge>
              </TD>
              <TD className="font-mono text-xs">{event.actorId ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
