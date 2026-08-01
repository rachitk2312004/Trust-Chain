import jsQR from "jsqr";

/** Decode QR from raw RGBA pixels (no OCR). */
export function decodeQrFromImageData(imageData: ImageData): string | null {
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "dontInvert",
  });
  return result?.data ?? null;
}

export async function decodeQrFromBlob(blob: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return decodeQrFromImageData(imageData);
}
