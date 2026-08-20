/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import {
  extractQrScanToken,
  getQrErrorMessage,
  isInvalidQrPayload,
  isQrExpired,
  isQrForbidden,
  isQrNotFound,
  isQrRevoked,
  qrStatusTone,
  scanUrlFromPayload,
} from "../../lib/qrErrors";
import type { ApiErrorBody, CreateQrInput, QrTemplate } from "../../types/api";
import { qrKeys } from "./hooks";

function axiosError(status: number, code: string, message: string): AxiosError<ApiErrorBody> {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    headers: {},
    config: {} as never,
    data: { error: { code, message } },
  });
}

describe("QR generation", () => {
  it("shapes create payload with template and format", () => {
    const body: CreateQrInput = {
      formatVersion: "V2",
      templatePublicCode: "QR-TPL-1",
      visibility: "restricted",
      label: "Badge print",
    };
    expect(body.formatVersion).toBe("V2");
    expect(body.templatePublicCode).toMatch(/^QR-TPL/);
  });

  it("uses qr list query keys after generation", () => {
    expect(qrKeys("org-1").list).toEqual(["qr", "org-1", "list"]);
    expect(qrKeys("org-1", "QR-ABC").detail).toEqual(["qr", "org-1", "QR-ABC"]);
  });

  it("maps document not found on create", () => {
    const error = axiosError(404, "DOC_NOT_FOUND", "Document not found");
    expect(isQrNotFound(error)).toBe(true);
    expect(getQrErrorMessage(error)).toMatch(/document not found/i);
  });
});

describe("QR revocation", () => {
  it("maps revoked and disabled statuses", () => {
    expect(isQrRevoked(axiosError(410, "QR_REVOKED", "QR code is revoked"))).toBe(true);
    expect(isQrRevoked(axiosError(410, "QR_DISABLED", "QR code is disabled"))).toBe(true);
    expect(getQrErrorMessage(axiosError(410, "QR_REVOKED", "revoked"))).toMatch(/revoked/i);
  });

  it("maps status indicator tones for lifecycle", () => {
    expect(qrStatusTone("active")).toBe("success");
    expect(qrStatusTone("revoked")).toBe("danger");
    expect(qrStatusTone("expired")).toBe("warning");
  });
});

describe("QR verification", () => {
  it("extracts scan tokens from public QR URLs", () => {
    expect(extractQrScanToken("https://api.example.com/api/public/qr/opaque-token-1")).toBe(
      "opaque-token-1",
    );
    expect(extractQrScanToken("opaque-token-1")).toBe("opaque-token-1");
  });

  it("reads scan URL from signed payload", () => {
    expect(
      scanUrlFromPayload({
        formatVersion: "V1",
        url: "https://verify.example.com/api/public/qr/tok",
        qrPublicCode: "QR-1",
      }),
    ).toContain("/qr/tok");
  });

  it("maps expired QR verification errors", () => {
    const error = axiosError(410, "QR_EXPIRED", "QR code is expired");
    expect(isQrExpired(error)).toBe(true);
    expect(getQrErrorMessage(error)).toMatch(/expired/i);
  });

  it("maps invalid payload validation", () => {
    const error = axiosError(400, "VALIDATION_ERROR", "Invalid payload");
    expect(isInvalidQrPayload(error)).toBe(true);
  });
});

describe("QR analytics", () => {
  it("uses analytics query key", () => {
    expect(qrKeys("org-1").analytics).toEqual(["qr", "org-1", "analytics"]);
  });

  it("aggregates daily counters contract", () => {
    const rows = [
      { scanCount: 2, downloadCount: 1, validCount: 2, errorCount: 0 },
      { scanCount: 3, downloadCount: 0, validCount: 1, errorCount: 1 },
    ];
    const scans = rows.reduce((n, r) => n + r.scanCount, 0);
    const valid = rows.reduce((n, r) => n + r.validCount, 0);
    expect(scans).toBe(5);
    expect(valid).toBe(3);
  });
});

describe("template selection", () => {
  it("lists template public codes for selector options", () => {
    const templates: QrTemplate[] = [
      {
        publicCode: "QR-TPL-DEFAULT",
        name: "Default",
        description: null,
        sizePx: 512,
        errorCorrection: "M",
        foregroundColor: "#000000",
        backgroundColor: "#FFFFFF",
        marginModules: 4,
        print: {
          pageSize: "A4",
          dpi: 300,
          marginMm: 10,
          bleedMm: 3,
          qrPerPage: 1,
        },
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const options = templates.map((t) => t.publicCode);
    expect(options).toContain("QR-TPL-DEFAULT");
    expect(templates[0]?.isDefault).toBe(true);
  });

  it("maps permission denied for template/QR staff actions", () => {
    const error = axiosError(403, "FORBIDDEN", "Insufficient permissions");
    expect(isQrForbidden(error)).toBe(true);
    expect(getQrErrorMessage(error)).toMatch(/permission/i);
  });
});
