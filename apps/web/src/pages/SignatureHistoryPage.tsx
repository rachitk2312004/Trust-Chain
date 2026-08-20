import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  FormError,
  FormHint,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { useSignature, useSignatureHistory, useSignatures } from "../features/signatures";
import { AppShellLayout } from "../layouts/AppShellLayout";
import {
  getSignatureErrorMessage,
  signatureEventTone,
} from "../lib/signatureErrors";
import { useSessionStore } from "../lib/sessionStore";

export function SignatureHistoryPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const [searchParams, setSearchParams] = useSearchParams();
  const signatureIdFromQuery = searchParams.get("signatureId") ?? "";
  const [selectedId, setSelectedId] = useState(signatureIdFromQuery);
  const activeId = selectedId || signatureIdFromQuery;

  const list = useSignatures(organizationId, { limit: 100 });
  const signature = useSignature(organizationId, activeId || undefined);
  const history = useSignatureHistory(organizationId, activeId || undefined);

  const options = useMemo(() => list.data?.signatures ?? [], [list.data]);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Signature history" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Signature history"
        description={
          signature.data?.signature
            ? `Timeline for ${signature.data.signature.publicId}`
            : "Append-only signature events"
        }
        actions={
          <Link to="/signatures" className="text-sm text-[var(--tc-accent)] hover:underline">
            All signatures
          </Link>
        }
      />

      <div className="mb-4 max-w-lg">
        <label className="mb-1 block text-sm text-[var(--tc-muted)]" htmlFor="history-signature">
          Signature
        </label>
        <Select
          id="history-signature"
          value={activeId}
          onChange={(e) => {
            const next = e.target.value;
            setSelectedId(next);
            if (next) setSearchParams({ signatureId: next });
            else setSearchParams({});
          }}
        >
          <option value="">Select a signature</option>
          {options.map((sig) => (
            <option key={sig.id} value={sig.id}>
              {sig.publicId} · {sig.status}
            </option>
          ))}
        </Select>
      </div>

      {!activeId ? (
        <FormHint>Select a signature to view its event timeline.</FormHint>
      ) : history.isError ? (
        <FormError>{getSignatureErrorMessage(history.error)}</FormError>
      ) : history.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading history…</p>
      ) : (
        <div className="relative">
          <div className="mb-4 space-y-3">
            {(history.data?.events ?? []).map((event, index) => (
              <div
                key={event.id}
                className="relative rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={signatureEventTone(event.eventType)}>{event.eventType}</Badge>
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
            {(history.data?.events ?? []).length === 0 ? (
              <FormHint>No events recorded for this signature.</FormHint>
            ) : null}
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
              {(history.data?.events ?? []).map((event) => (
                <TR key={`row-${event.id}`}>
                  <TD>{new Date(event.createdAt).toLocaleString()}</TD>
                  <TD>
                    <Badge tone={signatureEventTone(event.eventType)}>{event.eventType}</Badge>
                  </TD>
                  <TD className="font-mono text-xs">{event.actorId ?? "system"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </AppShellLayout>
  );
}
