const CERT_RE = /CERT-[A-Z0-9]+-[0-9A-F]+/gi;

function collectIds(text: string, into: Set<string>) {
  for (const match of text.matchAll(CERT_RE)) {
    into.add(match[0].toUpperCase());
  }
}

function collectFromHexStrings(text: string, into: Set<string>) {
  for (const match of text.matchAll(/<([0-9A-Fa-f]{16,})>/g)) {
    try {
      const hex = match[1];
      if (!hex || hex.length % 2) continue;
      const chars = [];
      for (let i = 0; i < hex.length; i += 2) {
        chars.push(String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16)));
      }
      collectIds(chars.join(""), into);
    } catch {
      // ignore
    }
  }
}

async function inflateZlib(chunk: Uint8Array): Promise<string | null> {
  try {
    const stream = new Blob([chunk]).stream().pipeThrough(new DecompressionStream("deflate"));
    const buffer = await new Response(stream).arrayBuffer();
    return new TextDecoder("latin1").decode(buffer);
  } catch {
    return null;
  }
}

/** Pull printed CERT- IDs out of a TrustChain PDF (text is hex-encoded inside Flate streams). */
export async function extractCertificatePublicIdsFromFile(file: File): Promise<string[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const latin1 = new TextDecoder("latin1").decode(bytes);
  const ids = new Set<string>();
  collectIds(latin1, ids);
  collectFromHexStrings(latin1, ids);

  const header = /\/Length\s+(\d+)\s*>>\s*stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = header.exec(latin1))) {
    const length = Number(match[1]);
    const start = match.index + match[0].length;
    const chunk = bytes.subarray(start, start + length);
    const inflated = await inflateZlib(chunk);
    if (!inflated) continue;
    collectIds(inflated, ids);
    collectFromHexStrings(inflated, ids);
  }
  return [...ids];
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
