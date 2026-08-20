export type BulkImportFormat = "csv" | "json";

/** Normalized row used for preview, validation, and issuance. */
export type BulkImportRow = {
  rowNumber: number;
  recipientName: string;
  recipientEmail: string | null;
  certificateIdentifier: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  templateIdentifier: string | null;
  title: string | null;
  metadata: Record<string, unknown>;
};

export type BulkRowValidationIssue = {
  code: string;
  message: string;
};

export type BulkValidatedRow = BulkImportRow & {
  errors: BulkRowValidationIssue[];
  warnings: BulkRowValidationIssue[];
  /** Resolved template UUID when templateIdentifier is valid. */
  resolvedTemplateId: string | null;
};

export type BulkValidationSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  invalidEmailCount: number;
  invalidDateCount: number;
  missingTemplateCount: number;
  malformedMetadataCount: number;
  revokedTemplateCount: number;
};

export type BulkPreviewResult = {
  format: BulkImportFormat;
  valid: boolean;
  rows: BulkValidatedRow[];
  summary: BulkValidationSummary;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BULK_ROWS = 2000;

const HEADER_ALIASES: Record<string, keyof Omit<BulkImportRow, "rowNumber" | "metadata"> | "metadata"> = {
  recipient_name: "recipientName",
  recipientname: "recipientName",
  name: "recipientName",
  recipient_email: "recipientEmail",
  recipientemail: "recipientEmail",
  email: "recipientEmail",
  certificate_identifier: "certificateIdentifier",
  certificateidentifier: "certificateIdentifier",
  certificate_id: "certificateIdentifier",
  external_id: "certificateIdentifier",
  issue_date: "issueDate",
  issued_at: "issueDate",
  issuedate: "issueDate",
  expiration_date: "expirationDate",
  expires_at: "expirationDate",
  expirationdate: "expirationDate",
  template_identifier: "templateIdentifier",
  templateidentifier: "templateIdentifier",
  template_id: "templateIdentifier",
  template_code: "templateIdentifier",
  title: "title",
  metadata: "metadata",
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Minimal CSV splitter that respects double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function emptyRow(rowNumber: number): BulkImportRow {
  return {
    rowNumber,
    recipientName: "",
    recipientEmail: null,
    certificateIdentifier: null,
    issueDate: null,
    expirationDate: null,
    templateIdentifier: null,
    title: null,
    metadata: {},
  };
}

function parseMetadataValue(raw: unknown, errors: BulkRowValidationIssue[]): Record<string, unknown> {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        errors.push({ code: "MALFORMED_METADATA", message: "Metadata must be a JSON object" });
        return {};
      }
      return parsed as Record<string, unknown>;
    } catch {
      errors.push({ code: "MALFORMED_METADATA", message: "Metadata JSON is malformed" });
      return {};
    }
  }
  errors.push({ code: "MALFORMED_METADATA", message: "Metadata must be a JSON object" });
  return {};
}

function asOptionalString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function rowFromRecord(raw: Record<string, unknown>, rowNumber: number): BulkImportRow {
  const metaErrors: BulkRowValidationIssue[] = [];
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const alias = HEADER_ALIASES[normalizeHeader(key)];
    if (alias) mapped[alias] = value;
  }

  const metadata = parseMetadataValue(mapped.metadata, metaErrors);
  // Surface parse errors into metadata placeholder for later validation pass.
  if (metaErrors.length) {
    metadata.__parseError = metaErrors[0]!.message;
  }

  return {
    rowNumber,
    recipientName: asOptionalString(mapped.recipientName) ?? "",
    recipientEmail: asOptionalString(mapped.recipientEmail),
    certificateIdentifier: asOptionalString(mapped.certificateIdentifier),
    issueDate: asOptionalString(mapped.issueDate),
    expirationDate: asOptionalString(mapped.expirationDate),
    templateIdentifier: asOptionalString(mapped.templateIdentifier),
    title: asOptionalString(mapped.title),
    metadata,
  };
}

export function parseBulkCsv(content: string): BulkImportRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw Object.assign(new Error("CSV content is empty"), { code: "EMPTY_IMPORT" });
  }

  const headers = splitCsvLine(lines[0]!).map(normalizeHeader);
  const fieldIndexes = new Map<string, number>();
  headers.forEach((header, index) => {
    const alias = HEADER_ALIASES[header];
    if (alias) fieldIndexes.set(alias, index);
  });

  if (!fieldIndexes.has("recipientName")) {
    throw Object.assign(new Error("CSV must include a recipient name column"), {
      code: "INVALID_CSV_HEADER",
    });
  }

  const rows: BulkImportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const record: Record<string, unknown> = {};
    for (const [field, index] of fieldIndexes.entries()) {
      record[field] = cells[index] ?? "";
    }
    rows.push(rowFromRecord(record, i + 1));
  }

  if (rows.length > MAX_BULK_ROWS) {
    throw Object.assign(new Error(`Import exceeds maximum of ${MAX_BULK_ROWS} rows`), {
      code: "TOO_MANY_ROWS",
    });
  }
  return rows;
}

export function parseBulkJson(content: string): BulkImportRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw Object.assign(new Error("JSON content is malformed"), { code: "INVALID_JSON" });
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)
      ? ((parsed as { rows: unknown[] }).rows)
      : null;

  if (!list) {
    throw Object.assign(new Error("JSON must be an array of rows or { rows: [] }"), {
      code: "INVALID_JSON",
    });
  }

  if (list.length > MAX_BULK_ROWS) {
    throw Object.assign(new Error(`Import exceeds maximum of ${MAX_BULK_ROWS} rows`), {
      code: "TOO_MANY_ROWS",
    });
  }

  return list.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      const row = emptyRow(index + 1);
      row.metadata = { __parseError: "Row must be an object" };
      return row;
    }
    return rowFromRecord(item as Record<string, unknown>, index + 1);
  });
}

export function parseBulkImport(format: BulkImportFormat, content: string): BulkImportRow[] {
  if (format === "csv") return parseBulkCsv(content);
  if (format === "json") return parseBulkJson(content);
  throw Object.assign(new Error("Unsupported import format"), { code: "UNSUPPORTED_FORMAT" });
}

export function parseFlexibleDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Support YYYY-MM-DD and full ISO.
  const isoCandidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed;
  const date = new Date(isoCandidate);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export type TemplateLookup = {
  id: string;
  code: string;
  status: string;
};

/**
 * Validates normalized rows. Template map keys are lowercased ids and codes.
 */
export function validateBulkRows(
  rows: BulkImportRow[],
  options: {
    templatesByKey: Map<string, TemplateLookup>;
    defaultTemplateId?: string | null;
    existingIdentifiers?: Set<string>;
  },
): BulkPreviewResult {
  const existing = options.existingIdentifiers ?? new Set<string>();
  const seenIdentifiers = new Set<string>();
  const seenIdentityKeys = new Set<string>();

  let duplicateCount = 0;
  let invalidEmailCount = 0;
  let invalidDateCount = 0;
  let missingTemplateCount = 0;
  let malformedMetadataCount = 0;
  let revokedTemplateCount = 0;

  const validated: BulkValidatedRow[] = rows.map((row) => {
    const errors: BulkRowValidationIssue[] = [];
    const warnings: BulkRowValidationIssue[] = [];
    let resolvedTemplateId: string | null = options.defaultTemplateId ?? null;

    if (!row.recipientName.trim()) {
      errors.push({ code: "MISSING_RECIPIENT_NAME", message: "Recipient name is required" });
    }

    if (row.recipientEmail) {
      if (!EMAIL_RE.test(row.recipientEmail)) {
        errors.push({ code: "INVALID_EMAIL", message: `Invalid email: ${row.recipientEmail}` });
        invalidEmailCount += 1;
      }
    }

    if (row.issueDate && !parseFlexibleDate(row.issueDate)) {
      errors.push({ code: "INVALID_ISSUE_DATE", message: `Invalid issue date: ${row.issueDate}` });
      invalidDateCount += 1;
    }
    if (row.expirationDate && !parseFlexibleDate(row.expirationDate)) {
      errors.push({
        code: "INVALID_EXPIRATION_DATE",
        message: `Invalid expiration date: ${row.expirationDate}`,
      });
      invalidDateCount += 1;
    }

    const issueDate = parseFlexibleDate(row.issueDate);
    const expirationDate = parseFlexibleDate(row.expirationDate);
    if (issueDate && expirationDate && expirationDate.getTime() < issueDate.getTime()) {
      errors.push({
        code: "INVALID_DATE_RANGE",
        message: "Expiration date is before issue date",
      });
      invalidDateCount += 1;
    }

    if (row.metadata.__parseError) {
      errors.push({
        code: "MALFORMED_METADATA",
        message: String(row.metadata.__parseError),
      });
      malformedMetadataCount += 1;
    }

    const templateKey = row.templateIdentifier?.trim();
    if (templateKey) {
      const found = options.templatesByKey.get(templateKey.toLowerCase());
      if (!found) {
        errors.push({
          code: "MISSING_TEMPLATE",
          message: `Template not found: ${templateKey}`,
        });
        missingTemplateCount += 1;
        resolvedTemplateId = null;
      } else if (found.status !== "active") {
        errors.push({
          code: "REVOKED_TEMPLATE",
          message: `Template is not active: ${templateKey}`,
        });
        revokedTemplateCount += 1;
        resolvedTemplateId = null;
      } else {
        resolvedTemplateId = found.id;
      }
    } else if (resolvedTemplateId) {
      const found = options.templatesByKey.get(resolvedTemplateId.toLowerCase());
      if (!found) {
        errors.push({
          code: "MISSING_TEMPLATE",
          message: "Default template not found",
        });
        missingTemplateCount += 1;
        resolvedTemplateId = null;
      } else if (found.status !== "active") {
        errors.push({
          code: "REVOKED_TEMPLATE",
          message: "Default template is not active",
        });
        revokedTemplateCount += 1;
        resolvedTemplateId = null;
      }
    }

    if (row.certificateIdentifier) {
      const idKey = row.certificateIdentifier.toLowerCase();
      if (seenIdentifiers.has(idKey) || existing.has(idKey)) {
        errors.push({
          code: "DUPLICATE_IDENTIFIER",
          message: `Duplicate certificate identifier: ${row.certificateIdentifier}`,
        });
        duplicateCount += 1;
      } else {
        seenIdentifiers.add(idKey);
      }
    }

    const identityKey = [
      row.recipientName.trim().toLowerCase(),
      (row.recipientEmail ?? "").toLowerCase(),
      (row.templateIdentifier ?? resolvedTemplateId ?? "").toLowerCase(),
      (row.title ?? "").toLowerCase(),
    ].join("|");
    if (seenIdentityKeys.has(identityKey)) {
      warnings.push({
        code: "DUPLICATE_ROW",
        message: "Row looks like a duplicate of an earlier row in this import",
      });
      duplicateCount += 1;
    } else {
      seenIdentityKeys.add(identityKey);
    }

    const { __parseError: _omit, ...cleanMetadata } = row.metadata;

    return {
      ...row,
      metadata: cleanMetadata,
      errors,
      warnings,
      resolvedTemplateId,
    };
  });

  const validRows = validated.filter((row) => row.errors.length === 0).length;
  const summary: BulkValidationSummary = {
    totalRows: validated.length,
    validRows,
    invalidRows: validated.length - validRows,
    duplicateCount,
    invalidEmailCount,
    invalidDateCount,
    missingTemplateCount,
    malformedMetadataCount,
    revokedTemplateCount,
  };

  return {
    format: "json",
    valid: summary.invalidRows === 0 && summary.totalRows > 0,
    rows: validated,
    summary,
  };
}

export { MAX_BULK_ROWS };
