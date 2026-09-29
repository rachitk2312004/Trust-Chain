/** Normalize SHA-256 hex or bytes32 (0x-prefixed) to 64 lowercase hex chars. */
export function normalizeContentHash(value: string | null | undefined): string | null {
  if (!value) return null;
  const hex = value.toLowerCase().replace(/^0x/, "").trim();
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  return hex;
}

export function contentHashesEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeContentHash(left);
  const b = normalizeContentHash(right);
  return Boolean(a && b && a === b);
}
