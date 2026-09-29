import type {
  BulkVerifyItemResult,
  IntakeVerifyItemResult,
  VerificationCheckHistoryRow,
} from "../types/api";

export type VerificationShareRow = {
  submitted: string;
  result: string;
  submittedName: string;
  issuedName: string;
  uniqueId: string;
  title: string;
  hash: string;
  detail: string;
  checkedAt: string;
  kind?: string;
  scope?: string;
  href?: string;
};

const KIND_LABELS: Record<string, string> = {
  intake: "PDF file",
  documents: "Stored document",
  certificates: "Issued certificate",
  hashes: "Hash list",
  identifiers: "CERT ID CSV",
};

function intakeResultLabel(row: IntakeVerifyItemResult): string {
  if (row.verdict === "authentic") return "Real";
  if (row.verdict === "not_found") return "Not issued";
  if (row.verdict === "identity_mismatch") return "Copied / wrong name";
  return row.outcome;
}

export function verificationKindLabel(kind?: string | null): string {
  if (!kind) return "Check";
  return KIND_LABELS[kind] ?? kind;
}

function dash(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function rowsFromIntake(
  items: IntakeVerifyItemResult[],
  checkedAt = new Date(),
): VerificationShareRow[] {
  return items.map((row) => ({
    submitted: row.fileName || row.label,
    result: intakeResultLabel(row),
    submittedName: dash(row.claimedName ?? row.printedName),
    issuedName: dash(row.recipientName),
    uniqueId: dash(row.publicId ?? row.certificateId),
    title: dash(row.title),
    hash: dash(row.contentHash),
    detail: dash(row.error ?? (row.valid ? "Issued TrustChain PDF" : undefined)),
    checkedAt: checkedAt.toLocaleString(),
    kind: "intake",
    scope: items.length === 1 ? "single" : "bulk",
    href: row.certificateId ? `/certificates/${row.certificateId}` : undefined,
  }));
}

export function rowsFromBulk(
  items: BulkVerifyItemResult[],
  checkedAt = new Date(),
): VerificationShareRow[] {
  return items.map((row) => ({
    submitted: row.label,
    result: row.outcome === "missing" ? "Not issued" : row.outcome === "invalid" ? "Copied / wrong name" : row.outcome,
    submittedName: dash(row.claimedName),
    issuedName: dash(row.recipientName),
    uniqueId: dash(row.uniqueId ?? row.publicId ?? row.contentHash),
    title: dash(row.title),
    hash: dash(row.contentHash),
    detail: dash(row.error ?? (row.valid ? "Passed" : undefined)),
    checkedAt: checkedAt.toLocaleString(),
    kind: row.category,
    scope: items.length === 1 ? "single" : "bulk",
    href: row.requestId
      ? `/verification/${row.requestId}`
      : row.certificateId
        ? `/certificates/${row.certificateId}`
        : undefined,
  }));
}

export function rowsFromCheckHistory(items: VerificationCheckHistoryRow[]): VerificationShareRow[] {
  return items.map((row) => ({
    submitted: row.fileName || row.inputLabel,
    result: row.verdict === "authentic" ? "Real" : row.verdict === "identity_mismatch" ? "Copied / wrong name" : row.outcome === "missing" ? "Not issued" : row.outcome,
    submittedName: "—",
    issuedName: dash(row.recipientName),
    uniqueId: dash(row.uniqueId ?? row.publicId ?? row.contentHash),
    title: dash(row.title),
    hash: dash(row.contentHash),
    detail: dash(row.detail ?? (row.valid ? "Passed" : undefined)),
    checkedAt: new Date(row.createdAt).toLocaleString(),
    kind: row.kind,
    scope: row.scope,
    href: row.requestId
      ? `/verification/${row.requestId}`
      : row.certificateId
        ? `/certificates/${row.certificateId}`
        : undefined,
  }));
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadVerificationExcel(fileName: string, rows: VerificationShareRow[]) {
  const header = [
    "Submitted",
    "Type",
    "Single or bulk",
    "Result",
    "Submitted name",
    "Issued to",
    "Unique ID",
    "Title",
    "Hash",
    "Detail",
    "Checked at",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.submitted,
        verificationKindLabel(row.kind),
        row.scope ?? "",
        row.result,
        row.submittedName,
        row.issuedName,
        row.uniqueId,
        row.title,
        row.hash,
        row.detail,
        row.checkedAt,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, fileName.endsWith(".csv") ? fileName : `${fileName}.csv`);
}

export function downloadVerificationPdf(title: string, rows: VerificationShareRow[]) {
  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.submitted)}</td>
        <td>${escapeHtml(verificationKindLabel(row.kind))}</td>
        <td>${escapeHtml(row.result)}</td>
        <td>${escapeHtml(row.submittedName)}</td>
        <td>${escapeHtml(row.issuedName)}</td>
        <td>${escapeHtml(row.uniqueId)}</td>
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(row.detail)}</td>
        <td>${escapeHtml(row.checkedAt)}</td>
      </tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Georgia, serif; color: #111; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { color: #555; margin: 0 0 16px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>TrustChain verification report · ${escapeHtml(new Date().toLocaleString())} · ${rows.length} row${rows.length === 1 ? "" : "s"}</p>
  <table>
    <thead>
      <tr>
        <th>Submitted</th><th>Type</th><th>Result</th><th>Submitted name</th>
        <th>Issued to</th><th>Unique ID</th><th>Title</th><th>Detail</th><th>Checked at</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
  const popup = window.open("", "_blank");
  if (!popup) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    triggerDownload(blob, `${title.replace(/\s+/g, "-").toLowerCase()}.html`);
    return;
  }
  popup.document.write(html);
  popup.document.close();
}
