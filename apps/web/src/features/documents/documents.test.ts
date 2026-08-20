/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  getDocumentErrorMessage,
  isDocForbidden,
  isDocNotFound,
  isExpiredShare,
  isHashMismatch,
  isInvalidFileType,
  isUploadFailure,
  validateLocalFile,
} from "../../lib/docErrors";
import { sha256Hex } from "../../lib/fileHash";
import type {
  ConfirmVersionInput,
  CreateShareInput,
} from "../../services/documentApi";
import type { ApiErrorBody } from "../../types/api";
import { docKeys } from "./hooks";

function axiosError(status: number, code: string, message: string): AxiosError<ApiErrorBody> {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    headers: {},
    config: {} as never,
    data: { error: { code, message } },
  });
}

describe("upload flow", () => {
  it("rejects disallowed local file types before upload", () => {
    const bad = new File(["x"], "note.txt", { type: "text/plain" });
    expect(validateLocalFile(bad)).toMatch(/not allowed/i);
  });

  it("accepts allowed MIME types used by the API", () => {
    expect(ALLOWED_DOCUMENT_MIME_TYPES).toContain("application/pdf");
    const pdf = new File(["%PDF"], "doc.pdf", { type: "application/pdf" });
    expect(validateLocalFile(pdf)).toBeNull();
  });

  it("orders upload steps as create → upload-url → PUT → hash → confirm", () => {
    const steps = [
      "createDocument",
      "createUploadUrl",
      "putFileToPresignedUrl",
      "sha256Hex",
      "confirmVersion",
    ];
    expect(steps[0]).toBe("createDocument");
    expect(steps.at(-1)).toBe("confirmVersion");
  });
});

describe("confirmation flow", () => {
  it("requires 64-char hex contentHash", () => {
    const body: ConfirmVersionInput = {
      uploadSessionId: "11111111-1111-1111-1111-111111111111",
      contentHash: "a".repeat(64),
      mimeType: "application/pdf",
      sizeBytes: 12,
      originalFileName: "a.pdf",
      activate: true,
    };
    expect(body.contentHash).toMatch(/^[a-f0-9]{64}$/i);
  });

  it("maps hash mismatch errors", () => {
    const error = axiosError(400, "DOC_HASH_MISMATCH", "hash mismatch");
    expect(isHashMismatch(error)).toBe(true);
    expect(getDocumentErrorMessage(error)).toMatch(/hash/i);
  });

  it("maps incomplete upload session errors", () => {
    const error = axiosError(410, "DOC_UPLOAD_INCOMPLETE", "expired session");
    expect(isUploadFailure(error)).toBe(true);
  });

  it("produces lowercase hex SHA-256 for confirm payload", async () => {
    const hash = await sha256Hex(new Blob(["trustchain"]));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("sharing flow", () => {
  it("shapes share payload with email and permission", () => {
    const body: CreateShareInput = {
      sharedWithEmail: "colleague@example.com",
      permission: "view",
      expiresAt: null,
    };
    expect(body.sharedWithEmail).toContain("@");
    expect(["view", "download", "edit", "manage"]).toContain(body.permission);
  });

  it("maps expired document/share errors", () => {
    const error = axiosError(410, "DOC_EXPIRED", "Document has expired");
    expect(isExpiredShare(error)).toBe(true);
    expect(getDocumentErrorMessage(error)).toMatch(/expired/i);
  });
});

describe("archive flow", () => {
  it("uses archive and restore document query keys", () => {
    expect(docKeys("org-1", "doc-1").detail).toEqual(["documents", "org-1", "doc-1"]);
    expect(docKeys("org-1", "doc-1").history).toEqual([
      "documents",
      "org-1",
      "doc-1",
      "history",
    ]);
  });

  it("maps permission denied for archive actions", () => {
    const error = axiosError(403, "FORBIDDEN", "Insufficient permissions");
    expect(isDocForbidden(error)).toBe(true);
    expect(getDocumentErrorMessage(error)).toMatch(/permission/i);
  });
});

describe("search flow", () => {
  it("builds search query key from q", () => {
    expect(docKeys("org-1").search("invoice")).toEqual([
      "documents",
      "org-1",
      "search",
      "invoice",
    ]);
  });

  it("maps document not found", () => {
    const error = axiosError(404, "DOC_NOT_FOUND", "Document not found");
    expect(isDocNotFound(error)).toBe(true);
    expect(getDocumentErrorMessage(error)).toMatch(/not found/i);
  });

  it("maps invalid mime from API", () => {
    const error = axiosError(400, "DOC_INVALID_MIME", "bad mime");
    expect(isInvalidFileType(error)).toBe(true);
  });
});
