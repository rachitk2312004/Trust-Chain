import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Field, FormError, FormHint, Label, Textarea } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { VerificationReportTable } from "../features/verification/VerificationReportTable";
import { useBulkVerify } from "../features/verification/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { parseCertClaims, readCertClaimCsv } from "../lib/verificationCsv";
import { rowsFromBulk } from "../lib/verificationReport";
import { getVerificationErrorMessage } from "../lib/verifyErrors";
import { useSessionStore } from "../lib/sessionStore";

export function VerificationBulkPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const feedback = useFeedback();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvName, setCsvName] = useState("");
  const [rawValues, setRawValues] = useState("cert_id,name\n");
  const bulk = useBulkVerify(organizationId ?? "");
  const claims = useMemo(() => parseCertClaims(rawValues), [rawValues]);

  async function onCsv(file: File | undefined) {
    if (!file) return;
    const rows = await readCertClaimCsv(file);
    setCsvName(file.name);
    const text = ["cert_id,name", ...rows.map((row) => `${row.identifier}${row.name ? `,${row.name}` : ""}`)].join("\n");
    setRawValues(text);
    feedback.success(`Loaded ${rows.length} row${rows.length === 1 ? "" : "s"} from ${file.name}`);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    bulk.mutate(
      { category: "identifiers", claims },
      {
        onSuccess: (data) =>
          feedback.success(`Checked ${data.summary.total} CERT IDs`, `${data.summary.valid} matched names`),
        onError: (err) => feedback.error(err, "Bulk verify failed"),
      },
    );
  }

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="CERT ID CSV" description="Match certificate IDs and names." />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="CERT ID CSV"
        description="Each row is a CERT ID plus the name the applicant used. We compare that name to the person the certificate was issued to."
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/verification/upload" className="text-[var(--tc-accent)] hover:underline">
              PDF files
            </Link>
            <Link to="/verification/history" className="text-[var(--tc-accent)] hover:underline">
              History
            </Link>
            <Link to="/verification" className="text-[var(--tc-accent)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />

      <form className="max-w-3xl space-y-4" onSubmit={onSubmit}>
        <div className="rounded-xl border border-dashed border-[var(--tc-border)] bg-[var(--tc-surface)] px-4 py-5">
          <p className="font-medium">Upload CSV</p>
          <p className="mt-1 text-sm text-[var(--tc-muted)]">
            Columns: <span className="font-mono">cert_id</span>, <span className="font-mono">name</span>
          </p>
          <p className="mt-1 font-mono text-xs text-[var(--tc-muted)]">CERT-MTTBIU71-CEB87247,Aditya</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="text-sm"
              onChange={(event) => void onCsv(event.target.files?.[0])}
            />
            {csvName ? <span className="text-xs text-[var(--tc-muted)]">{csvName}</span> : null}
          </div>
        </div>
        <Field>
          <Label htmlFor="bulk-values">Rows</Label>
          <Textarea
            id="bulk-values"
            className="min-h-40"
            value={rawValues}
            onChange={(e) => setRawValues(e.target.value)}
            placeholder={"cert_id,name\nCERT-MTTBIU71-CEB87247,Aditya"}
          />
          <FormHint>
            {claims.length} row{claims.length === 1 ? "" : "s"} ready (max 50). A different name on a real CERT ID is
            flagged as copied.
          </FormHint>
        </Field>
        <FormError>{bulk.error ? getVerificationErrorMessage(bulk.error) : null}</FormError>
        <Button type="submit" disabled={bulk.isPending || claims.length === 0}>
          {bulk.isPending ? "Checking…" : "Check CERT IDs"}
        </Button>
      </form>

      {bulk.data ? (
        <div className="mt-8 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Matched {bulk.data.summary.valid}</Badge>
            <Badge tone="danger">Failed {bulk.data.summary.failed}</Badge>
          </div>
          <VerificationReportTable title="CSV results" rows={rowsFromBulk(bulk.data.results)} />
        </div>
      ) : null}
    </AppShellLayout>
  );
}
