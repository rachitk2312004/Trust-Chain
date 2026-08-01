/** Sandbox helpers — keep untrusted page content isolated from privileged APIs. */

export function sanitizeText(input: string, max = 8_000): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue;
    out += ch;
    if (out.length >= max) break;
  }
  return out;
}

export function isTrustedApiOrigin(apiBaseUrl: string, responseUrl: string): boolean {
  try {
    const api = new URL(apiBaseUrl);
    const res = new URL(responseUrl);
    return api.origin === res.origin;
  } catch {
    return false;
  }
}
