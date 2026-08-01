export function assertNonEmpty(input: unknown, code = "MOBILE_INVALID_INPUT"): string {
  if (typeof input !== "string" || input.trim().length === 0) throw new Error(code);
  return input.trim();
}
