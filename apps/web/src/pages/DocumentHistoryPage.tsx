import { useParams } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { useDocumentHistory } from "../features/documents/hooks";
import { getDocumentErrorMessage } from "../lib/docErrors";
import { useSessionStore } from "../lib/sessionStore";

export function DocumentHistoryPage() {
  const { documentId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const history = useDocumentHistory(organizationId, documentId);

  if (!organizationId) return <FormError>Select an organization first.</FormError>;
  if (history.isError) {
    return <FormError>{getDocumentErrorMessage(history.error)}</FormError>;
  }
  if (history.isLoading) {
    return <p className="text-sm text-[var(--tc-muted)]">Loading audit history…</p>;
  }

  const entries = history.data ?? [];
  if (entries.length === 0) {
    return <FormHint>No audit events yet.</FormHint>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded-lg border border-[var(--tc-border)] bg-[var(--tc-surface)] px-4 py-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-[var(--tc-fg)]">{entry.action}</p>
            <p className="text-xs text-[var(--tc-muted)]">
              {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
          <p className="mt-1 text-xs text-[var(--tc-muted)]">
            Actor: {entry.actorUserId ?? "system"}
          </p>
          {entry.metadata ? (
            <pre className="mt-2 overflow-x-auto rounded bg-[var(--tc-surface-2)] p-2 text-xs text-[var(--tc-fg)]">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
