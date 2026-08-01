export type ExportFormat = "json" | "csv" | "pdf";

export type ExportRequest = {
  format: ExportFormat;
  filename: string;
  rowCount: number;
};

export function buildExportRequest(format: ExportFormat, rowCount: number): ExportRequest {
  const ext = format === "pdf" ? "pdf" : format;
  return {
    format,
    filename: `report-${Date.now()}.${ext}`,
    rowCount,
  };
}
