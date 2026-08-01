import { createHash } from "node:crypto";
import { DocumentAllowedMimeTypes, DocumentMaxUploadBytes } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function assertAllowedMimeType(mimeType: string): void {
  if (!(DocumentAllowedMimeTypes as readonly string[]).includes(mimeType)) {
    throw new AppError(400, "DOC_INVALID_MIME", `MIME type not allowed: ${mimeType}`, {
      allowed: DocumentAllowedMimeTypes,
    });
  }
}

export function assertAllowedSize(sizeBytes: number | bigint): void {
  const size = typeof sizeBytes === "bigint" ? Number(sizeBytes) : sizeBytes;
  if (!Number.isFinite(size) || size < 1) {
    throw new AppError(400, "DOC_TOO_LARGE", "File size must be at least 1 byte");
  }
  if (size > DocumentMaxUploadBytes) {
    throw new AppError(
      400,
      "DOC_TOO_LARGE",
      `File exceeds maximum size of ${DocumentMaxUploadBytes} bytes`,
      { maxBytes: DocumentMaxUploadBytes, sizeBytes: size },
    );
  }
}

export function assertObjectKeyPrefix(objectKey: string, organizationId: string): void {
  const prefix = `orgs/${organizationId}/documents/`;
  if (!objectKey.startsWith(prefix)) {
    throw new AppError(
      400,
      "DOC_FORBIDDEN",
      "Object key is outside the organization document prefix",
    );
  }
}
