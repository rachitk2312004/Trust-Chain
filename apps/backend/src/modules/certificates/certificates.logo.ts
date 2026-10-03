import sharp from "sharp";

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "").trim();
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => `${c}${c}`)
          .join("")
      : cleaned.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 255, g: 253, b: 248 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Normalize any supported logo bytes to PNG and flatten onto the certificate
 * background so transparent/white marks blend with the parchment field.
 */
export async function prepareLogoForCertificate(
  input: Buffer,
  backgroundColor = "#FFFDF8",
  maxWidth = 480,
  maxHeight = 240,
): Promise<Buffer> {
  const bg = parseHexColor(backgroundColor);
  return sharp(input)
    .rotate()
    .ensureAlpha()
    .resize(maxWidth, maxHeight, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: bg })
    .png()
    .toBuffer();
}

/** Store-time normalize (keeps alpha for later blend against each template bg). */
export async function normalizeLogoUpload(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .ensureAlpha()
    .resize(960, 480, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}
