import { Link } from "react-router-dom";
import { Button, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import {
  downloadVerificationExcel,
  downloadVerificationPdf,
  verificationKindLabel,
  type VerificationShareRow,
} from "../../lib/verificationReport";

export function VerificationReportTable({
  rows,
  title,
  empty,
}: {
  rows: VerificationShareRow[];
  title: string;
  empty?: string;
}) {
  if (!rows.length) {
    return empty ? <p className="text-sm text-[var(--tc-muted)]">{empty}</p> : null;
  }

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          {title}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => downloadVerificationExcel(`trustchain-${stamp}`, rows)}
          >
            Export Excel
          </Button>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => downloadVerificationPdf(title, rows)}
          >
            Export PDF
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Submitted</TH>
              <TH>Result</TH>
              <TH>Submitted name</TH>
              <TH>Issued to</TH>
              <TH>Unique ID</TH>
              <TH>Detail</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row, index) => (
              <TR key={`${row.submitted}-${row.uniqueId}-${index}`}>
                <TD>
                  {row.href ? (
                    <Link to={row.href} className="text-[var(--tc-accent)] hover:underline">
                      {row.submitted}
                    </Link>
                  ) : (
                    row.submitted
                  )}
                  {row.kind ? (
                    <p className="text-xs text-[var(--tc-muted)]">
                      {verificationKindLabel(row.kind)}
                      {row.scope ? ` · ${row.scope}` : ""}
                    </p>
                  ) : null}
                </TD>
                <TD className="capitalize">{row.result}</TD>
                <TD>{row.submittedName}</TD>
                <TD>{row.issuedName}</TD>
                <TD className="font-mono text-xs">{row.uniqueId}</TD>
                <TD className="text-[var(--tc-muted)]">{row.detail}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
