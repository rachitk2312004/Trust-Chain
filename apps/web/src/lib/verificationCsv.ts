const HASH_HEADERS = new Set(["hash", "sha256", "sha-256", "content_hash", "contenthash", "digest"]);
const ID_HEADERS = new Set([
  "cert",
  "cert_id",
  "certificate",
  "public_id",
  "publicid",
  "identifier",
  "id",
]);
const NAME_HEADERS = new Set([
  "name",
  "applicant",
  "applicant_name",
  "recipient",
  "recipient_name",
  "claimed_name",
  "full_name",
  "holder",
]);
const FILE_HEADERS = new Set(["file", "filename", "file_name", "pdf"]);

export const VERIFICATION_LIST_LIMIT = 50;
export const CERT_PUBLIC_ID_RE = /CERT-[A-Z0-9]+-[0-9A-F]+/i;

export type CertClaim = {
  identifier: string;
  name?: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === "," || ch === ";" || ch === "\t") {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out.map((cell) => cell.trim());
}

function headerKey(cell: string): string {
  return cell.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isHeaderRow(cells: string[]): boolean {
  return cells.some((cell) => {
    const key = headerKey(cell);
    return HASH_HEADERS.has(key) || ID_HEADERS.has(key) || NAME_HEADERS.has(key) || FILE_HEADERS.has(key);
  });
}

export function parseVerificationListText(text: string, mode: "hashes" | "identifiers"): string[] {
  return parseCertClaims(text)
    .map((row) => row.identifier)
    .filter((value) => (mode === "hashes" ? true : Boolean(value)))
    .slice(0, VERIFICATION_LIST_LIMIT);
}

export function parseCertClaims(text: string): CertClaim[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0];
  if (!firstLine) return [];
  const first = splitCsvLine(firstLine);
  const headed = isHeaderRow(first);
  const keys = headed ? first.map(headerKey) : [];
  const idCol = headed ? Math.max(0, keys.findIndex((key) => ID_HEADERS.has(key))) : 0;
  const nameCol = headed ? keys.findIndex((key) => NAME_HEADERS.has(key)) : first.length > 1 ? 1 : -1;
  const start = headed ? 1 : 0;
  const rows: CertClaim[] = [];

  for (const line of lines.slice(start)) {
    const cells = splitCsvLine(line);
    const rawId = (headed ? cells[idCol] : cells.find((cell) => CERT_PUBLIC_ID_RE.test(cell)) ?? cells[0])?.trim();
    if (!rawId) continue;
    const cert = rawId.match(CERT_PUBLIC_ID_RE)?.[0]?.toUpperCase() ?? rawId;
    const name = nameCol >= 0 ? cells[nameCol]?.trim() : !headed && cells[1] ? cells[1].trim() : undefined;
    rows.push({ identifier: cert, name: name || undefined });
  }

  return rows.slice(0, VERIFICATION_LIST_LIMIT);
}

export function parseFileNameClaims(text: string): Record<string, string> {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0];
  if (!firstLine) return {};
  const first = splitCsvLine(firstLine);
  const headed = isHeaderRow(first);
  const keys = headed ? first.map(headerKey) : [];
  const fileCol = headed ? Math.max(0, keys.findIndex((key) => FILE_HEADERS.has(key))) : 0;
  const nameCol = headed ? keys.findIndex((key) => NAME_HEADERS.has(key)) : 1;
  const start = headed ? 1 : 0;
  const map: Record<string, string> = {};
  for (const line of lines.slice(start)) {
    const cells = splitCsvLine(line);
    const file = cells[fileCol]?.trim();
    const name = nameCol >= 0 ? cells[nameCol]?.trim() : undefined;
    if (file && name) map[file] = name;
  }
  return map;
}

export async function readVerificationCsvFile(
  file: File,
  mode: "hashes" | "identifiers",
): Promise<string[]> {
  const text = await file.text();
  return parseVerificationListText(text, mode);
}

export async function readCertClaimCsv(file: File): Promise<CertClaim[]> {
  return parseCertClaims(await file.text());
}
