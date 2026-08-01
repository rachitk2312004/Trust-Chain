import type { ScanCandidate, ScanCandidateType } from "../types/extension.types.js";

const VERIFY_CODE = /\bVERIFY-\d{8}-[0-9A-Fa-f]{8}\b/g;
const PUB_VERIFY = /\bPUB-VERIFY-[0-9A-Fa-f]{8}\b/gi;
const SHA256 = /\b[a-fA-F0-9]{64}\b/g;
const TX_HASH = /\b0x[a-fA-F0-9]{64}\b/g;

const PATH_PATTERNS: Array<{
  re: RegExp;
  type: ScanCandidateType;
  group: number;
}> = [
  { re: /\/qr\/([^/?#]+)/i, type: "qr_token", group: 1 },
  { re: /\/link\/([^/?#]+)/i, type: "link_token", group: 1 },
  { re: /\/verify\/(VERIFY-\d{8}-[0-9A-Fa-f]{8})/i, type: "verification_code", group: 1 },
  { re: /\/document\/(PUB-VERIFY-[0-9A-Fa-f]{8})/i, type: "public_verify_code", group: 1 },
  { re: /\/hash\/([a-fA-F0-9]{64})/i, type: "hash", group: 1 },
  { re: /\/tx\/(0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64})/i, type: "tx", group: 1 },
];

function pushUnique(
  out: ScanCandidate[],
  type: ScanCandidateType,
  value: string,
  source: ScanCandidate["source"],
): void {
  const normalized = value.trim();
  if (!normalized) return;
  if (out.some((c) => c.type === type && c.value === normalized)) return;
  out.push({ type, value: normalized, source });
}

/** Detect TrustChain identifiers and public URL shapes in free text. */
export function detectCandidates(
  text: string,
  source: ScanCandidate["source"] = "manual",
): ScanCandidate[] {
  const out: ScanCandidate[] = [];
  if (!text) return out;

  for (const { re, type, group } of PATH_PATTERNS) {
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let match: RegExpExecArray | null;
    while ((match = global.exec(text)) !== null) {
      const value = match[group];
      if (value) pushUnique(out, type, value, source);
    }
  }

  for (const m of text.matchAll(VERIFY_CODE)) {
    pushUnique(out, "verification_code", m[0]!, source);
  }
  for (const m of text.matchAll(PUB_VERIFY)) {
    pushUnique(out, "public_verify_code", m[0]!.toUpperCase(), source);
  }
  for (const m of text.matchAll(TX_HASH)) {
    pushUnique(out, "tx", m[0]!, source);
  }
  for (const m of text.matchAll(SHA256)) {
    // Prefer explicit /hash/ path matches; bare hex only if nothing else matched for this value
    if (!out.some((c) => c.value.toLowerCase() === m[0]!.toLowerCase())) {
      pushUnique(out, "hash", m[0]!.toLowerCase(), source);
    }
  }

  // Whole-string URL fallback
  if (/^https?:\/\//i.test(text.trim())) {
    pushUnique(out, "url", text.trim(), source);
  }

  return out;
}

export function lookupKeyForCandidate(candidate: ScanCandidate): string {
  return `${candidate.type}:${candidate.value}`;
}
