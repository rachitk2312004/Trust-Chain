import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  FormError,
  FormHint,
  Input,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { OutcomeBadge } from "../features/verification/VerificationResultPanels";
import { useVerificationHistory } from "../features/verification/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getVerificationErrorMessage } from "../lib/verifyErrors";
import { useSessionStore } from "../lib/sessionStore";

const PAGE_SIZE = 20;

export function VerificationHistoryPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const [status, setStatus] = useState("");
  const [outcome, setOutcome] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [offset, setOffset] = useState(0);

  const params = useMemo(
    () => ({
      status: status || undefined,
      outcome: outcome || undefined,
      documentId: documentId.trim() || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [status, outcome, documentId, offset],
  );

  const history = useVerificationHistory(organizationId, params);
  const rows = history.data?.verifications ?? [];

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
        description="Search and filter organization verification requests."
        actions={
          <Link to="/verification" className="text-sm text-[var(--tc-accent)] hover:underline">
            Back to dashboard
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          className="w-40"
          value={status}
          onChange={(e) => {
            setOffset(0);
            setStatus(e.target.value);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </Select>
        <Select
          className="w-40"
          value={outcome}
          onChange={(e) => {
            setOffset(0);
            setOutcome(e.target.value);
          }}
          aria-label="Filter by outcome"
        >
          <option value="">All outcomes</option>
          <option value="valid">Valid</option>
          <option value="invalid">Invalid</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
          <option value="missing">Missing</option>
          <option value="tampered">Tampered</option>
        </Select>
        <Input
          className="min-w-[16rem] flex-1"
          placeholder="Filter by document UUID…"
          value={documentId}
          onChange={(e) => {
            setOffset(0);
            setDocumentId(e.target.value);
          }}
        />
      </div>

      {history.isError ? (
        <FormError>{getVerificationErrorMessage(history.error)}</FormError>
      ) : null}

      {history.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading history…</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Code</TH>
              <TH>Document</TH>
              <TH>Status</TH>
              <TH>Outcome</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((item) => (
              <TR key={item.request.id}>
                <TD>
                  {"sourceType" in item && item.sourceType === "certificate" ? (
                    <Link
                      to={`/certificates/verify/${item.request.verificationCode}`}
                      className="text-[var(--tc-accent)] hover:underline"
                    >
                      {item.request.verificationCode}
                    </Link>
                  ) : (
                    <Link
                      to={`/verification/${item.request.id}`}
                      className="text-[var(--tc-accent)] hover:underline"
                    >
                      {item.request.verificationCode}
                    </Link>
                  )}
                </TD>
                <TD className="font-mono text-xs">
                  {"sourceType" in item && item.sourceType === "certificate"
                    ? "Certificate"
                    : `${item.request.documentId.slice(0, 8)}…`}
                </TD>
                <TD>{item.request.status}</TD>
                <TD>
                  <OutcomeBadge outcome={item.outcome} />
                </TD>
                <TD>{new Date(item.request.createdAt).toLocaleString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {!history.isLoading && rows.length === 0 ? (
        <FormHint>No verifications matched these filters.</FormHint>
      ) : null}

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
          disabled={rows.length < PAGE_SIZE || history.isFetching}
          onClick={() => setOffset((v) => v + PAGE_SIZE)}
        >
          Next
        </Button>
        <span className="text-xs text-[var(--tc-muted)]">Offset {offset}</span>
      </div>
    </AppShellLayout>
  );
}
