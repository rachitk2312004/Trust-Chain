export function normalizePersonName(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function namesMatch(left?: string | null, right?: string | null): boolean {
  const a = normalizePersonName(left ?? "");
  const b = normalizePersonName(right ?? "");
  if (!a || !b) return true;
  if (a === b) return true;
  const aParts = a.split(" ");
  const bParts = b.split(" ");
  if (aParts[0] === bParts[0] && (aParts.length === 1 || bParts.length === 1)) return true;
  return a.includes(b) || b.includes(a);
}

export function identityMismatchMessage(issuedTo: string, submittedAs: string): string {
  return `Copied or renamed certificate. Submitted as ${submittedAs}. Issued to ${issuedTo}.`;
}
