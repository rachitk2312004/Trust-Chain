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

export function assertApiUrl(url: string): string {
  const parsed = new URL(url);
  return parsed.toString().replace(/\/$/, "");
}
