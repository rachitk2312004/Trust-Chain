import { parseApiError } from "./apiErrors";

export function isDocForbidden(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.status === 403 || parsed.code === "FORBIDDEN";
}

export function isDocNotFound(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.status === 404 || parsed.code === "DOC_NOT_FOUND";
}

export function isInvalidFileType(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "DOC_INVALID_MIME" ||
    parsed.code === "VALIDATION_ERROR" ||
    Boolean(parsed.message?.toLowerCase().includes("mime"))
  );
}

export function isUploadFailure(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "DOC_UPLOAD_INCOMPLETE" ||
    parsed.code === "DOC_TOO_LARGE" ||
    parsed.code === "DOC_MALWARE" ||
    parsed.status === 0
  );
}

export function isHashMismatch(error: unknown): boolean {
  return parseApiError(error).code === "DOC_HASH_MISMATCH";
}

export function isExpiredShare(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.code === "DOC_EXPIRED" || parsed.code === "DOC_DELETED";
}

export function getDocumentErrorMessage(error: unknown): string {
  if (isHashMismatch(error)) {
    return "File hash does not match the uploaded object. Re-upload and try again.";
  }
  if (isInvalidFileType(error)) {
    return "This file type is not allowed.";
  }
  if (isDocForbidden(error)) {
    return "You do not have permission for this document action.";
  }
  if (isDocNotFound(error)) {
    return "Document not found.";
  }
  if (isExpiredShare(error)) {
    const code = parseApiError(error).code;
    if (code === "DOC_DELETED") return "This document has been deleted.";
    return "This document or share link has expired.";
  }
  if (isUploadFailure(error)) {
    return parseApiError(error).message || "Upload failed.";
  }
  return parseApiError(error).message;
}

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_DOCUMENT_UPLOAD_BYTES = 25 * 1024 * 1024;

export function validateLocalFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
    return "This file type is not allowed.";
  }
  if (file.size <= 0) return "File is empty.";
  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) return "File exceeds the 25 MiB limit.";
  return null;
}
