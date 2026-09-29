import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Select } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { VerificationReportTable } from "../features/verification/VerificationReportTable";
import { useCheckHistory } from "../features/verification/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { rowsFromCheckHistory } from "../lib/verificationReport";
import { getVerificationErrorMessage } from "../lib/verifyErrors";
import { useSessionStore } from "../lib/sessionStore";

const PAGE_SIZE = 20;

export function VerificationHistoryPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const [kind, setKind] = useState("");
  const [offset, setOffset] = useState(0);

  const params = useMemo(
    () => ({
      kind: kind || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [kind, offset],
  );

  const history = useCheckHistory(organizationId, params);
  const rows = rowsFromCheckHistory(history.data?.rows ?? []);
  const total = history.data?.total ?? 0;

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Verification history" />
        <FormHint>Select an organization to view verification history.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Verification history"
        description="Every PDF, hash CSV, CERT ID, and stored-file check. Export the table as Excel or PDF."
        actions={
          <Link to="/verification" className="text-sm text-[var(--tc-accent)] hover:underline">
            Back to dashboard
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          className="w-56"
          value={kind}
          onChange={(e) => {
            setOffset(0);
            setKind(e.target.value);
          }}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          <option value="intake">PDF files</option>
          <option value="identifiers">CERT ID CSV</option>
        </Select>
      </div>

      {history.isError ? (
        <FormError>{getVerificationErrorMessage(history.error)}</FormError>
      ) : null}

      {history.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading history…</p>
      ) : (
        <VerificationReportTable
          title="Check history"
          rows={rows}
          empty="No checks matched these filters."
        />
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={offset === 0 || history.isFetching}
          onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={offset + PAGE_SIZE >= total || history.isFetching}
          onClick={() => setOffset((v) => v + PAGE_SIZE)}
        >
          Next
        </Button>
        <span className="text-xs text-[var(--tc-muted)]">
          {total ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}` : "Offset 0"}
        </span>
      </div>
    </AppShellLayout>
  );
}
