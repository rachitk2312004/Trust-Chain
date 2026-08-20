import { useParams } from "react-router-dom";
import { Badge, FormError, FormHint } from "@trustchain/ui";
import { useDocumentVersions } from "../features/documents/hooks";
import { getDocumentErrorMessage } from "../lib/docErrors";
import { useSessionStore } from "../lib/sessionStore";

export function DocumentVersionsPage() {
  const { documentId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const versions = useDocumentVersions(organizationId, documentId);

  if (!organizationId) return <FormError>Select an organization first.</FormError>;
  if (versions.isError) {
    return <FormError>{getDocumentErrorMessage(versions.error)}</FormError>;
  }
  if (versions.isLoading) {
    return <p className="text-sm text-[var(--tc-muted)]">Loading versions…</p>;
  }

  const rows = versions.data ?? [];
  if (rows.length === 0) {
    return <FormHint>No versions yet.</FormHint>;
  }

  return (
    <ol className="relative space-y-0 border-l border-[var(--tc-border)] pl-6">
      {rows.map((version) => (
        <li key={version.id} className="relative pb-8">
          <span className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-[var(--tc-accent)] bg-[var(--tc-surface)]" />
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-[var(--tc-fg)]">v{version.versionNumber}</p>
            {version.isCurrent ? <Badge tone="success">Current</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-[var(--tc-muted)]">
            {version.originalFileName} · {version.mimeType} ·{" "}
            {version.sizeBytes.toLocaleString()} bytes
          </p>
          <p className="mt-1 break-all font-mono text-xs text-[var(--tc-muted)]">
            {version.contentHash}
          </p>
          <p className="mt-1 text-xs text-[var(--tc-muted)]">
            {new Date(version.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}
