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

/** Reject URL hosts / product chrome that PDF text extraction often picks up as a “name”. */
export function looksLikePersonName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  if (/https?:\/\//i.test(trimmed)) return false;
  if (/\b(www\.)/i.test(trimmed)) return false;
  if (/\.(com|org|net|io|app|dev|edu|gov|in|uk|us|co)\b/i.test(trimmed)) return false;
  if (/vercel\.app|localhost|trust-?chain/i.test(trimmed)) return false;
  if (/cert-|certificate|verify|issued|authorized|signature|scan to|organization/i.test(trimmed)) {
    return false;
  }
  if (
    /\b(solutions|limited|private|company|corp|inc|ltd|pvt|technologies|systems|group|enterprises|services)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  // Prefer at least one space (first + last) or a single alphabetic token without digits/domains.
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(trimmed)) return false;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;
  return true;
}
