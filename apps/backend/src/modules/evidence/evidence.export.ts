import { EvidenceDefaults } from "@trustchain/config";

export type EvidenceExportRow = {
  id: string;
  publicCode: string;
  title: string;
  status: string;
  currentVersion: number;
  checksumSha256: string;
  frameworks: string[];
  tags: string[];
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number;
  createdAt: string;
  links?: Array<{ targetType: string; targetId: string; label: string | null }>;
  custody?: Array<{ action: string; integrityHash: string; createdAt: string }>;
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportEvidenceToJson(rows: EvidenceExportRow[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: rows.length,
      evidence: rows,
    },
    null,
    2,
  );
}

export function exportEvidenceToCsv(rows: EvidenceExportRow[]): string {
  const headers = [
    "id",
    "publicCode",
    "title",
    "status",
    "currentVersion",
    "checksumSha256",
    "frameworks",
    "tags",
    "mimeType",
    "fileName",
    "sizeBytes",
    "createdAt",
    "linkCount",
    "custodyCount",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.publicCode,
        row.title,
        row.status,
        String(row.currentVersion),
        row.checksumSha256,
        row.frameworks.join("|"),
        row.tags.join("|"),
        row.mimeType ?? "",
        row.fileName ?? "",
        String(row.sizeBytes),
        row.createdAt,
        String(row.links?.length ?? 0),
        String(row.custody?.length ?? 0),
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
  }
  return lines.join("\n");
}

export function generateEvidenceExport(
  rows: EvidenceExportRow[],
  format: "json" | "csv",
): { content: string; rowCount: number; contentType: string } {
  const capped = rows.slice(0, EvidenceDefaults.maxExportRows);
  if (format === "csv") {
    return {
      content: exportEvidenceToCsv(capped),
      rowCount: capped.length,
      contentType: "text/csv",
    };
  }
  return {
    content: exportEvidenceToJson(capped),
    rowCount: capped.length,
    contentType: "application/json",
  };
}
