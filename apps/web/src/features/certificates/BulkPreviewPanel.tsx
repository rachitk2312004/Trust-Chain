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
import type { CertificateBulkPreview } from "../../types/api";

export function BulkPreviewPanel({
  preview,
  maxRows = 50,
}: {
  preview: CertificateBulkPreview | null | undefined;
  maxRows?: number;
}) {
  if (!preview) {
    return <FormHint>Upload a CSV or JSON file to preview rows and validation results.</FormHint>;
  }

  const rows = preview.rows.slice(0, maxRows);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge tone={preview.valid ? "success" : "warning"}>
          {preview.valid ? "Ready to issue" : "Has validation issues"}
        </Badge>
        <Badge tone="neutral">{preview.summary.totalRows} total</Badge>
        <Badge tone="success">{preview.summary.validRows} valid</Badge>
        <Badge tone={preview.summary.invalidRows ? "danger" : "neutral"}>
          {preview.summary.invalidRows} invalid
        </Badge>
        {preview.summary.duplicateCount ? (
          <Badge tone="warning">{preview.summary.duplicateCount} duplicates</Badge>
        ) : null}
        {preview.summary.invalidEmailCount ? (
          <Badge tone="danger">{preview.summary.invalidEmailCount} bad emails</Badge>
        ) : null}
        {preview.summary.missingTemplateCount ? (
          <Badge tone="danger">{preview.summary.missingTemplateCount} missing templates</Badge>
        ) : null}
        {preview.summary.revokedTemplateCount ? (
          <Badge tone="danger">{preview.summary.revokedTemplateCount} inactive templates</Badge>
        ) : null}
      </div>

      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>Recipient</TH>
            <TH>Email</TH>
            <TH>Identifier</TH>
            <TH>Template</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.rowNumber}>
              <TD>{row.rowNumber}</TD>
              <TD>{row.recipientName || "—"}</TD>
              <TD>{row.recipientEmail || "—"}</TD>
              <TD className="font-mono text-xs">{row.certificateIdentifier || "—"}</TD>
              <TD>{row.templateIdentifier || "default"}</TD>
              <TD>
                {row.errors.length ? (
                  <Badge tone="danger">invalid</Badge>
                ) : row.warnings.length ? (
                  <Badge tone="warning">warning</Badge>
                ) : (
                  <Badge tone="success">ok</Badge>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {preview.rows.length > maxRows ? (
        <FormHint>
          Showing first {maxRows} of {preview.rows.length} rows.
        </FormHint>
      ) : null}

      {preview.rows.some((row) => row.errors.length > 0) ? (
        <div className="rounded border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-3">
          <p className="mb-2 text-sm font-medium">Validation report</p>
          <ul className="max-h-48 space-y-1 overflow-auto text-xs text-[var(--tc-muted)]">
            {preview.rows
              .filter((row) => row.errors.length > 0)
              .slice(0, 40)
              .flatMap((row) =>
                row.errors.map((err) => (
                  <li key={`${row.rowNumber}-${err.code}-${err.message}`}>
                    Row {row.rowNumber}: {err.message}
                  </li>
                )),
              )}
          </ul>
        </div>
      ) : null}

      {!preview.valid ? (
        <FormError>
          Fix invalid rows before starting issuance (or disable strict validation if supported).
        </FormError>
      ) : null}
    </div>
  );
}
