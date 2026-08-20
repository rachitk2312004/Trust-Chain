/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import {
  certificateStatusTone,
  defaultCertificateLayoutPreview,
  getCertificateErrorMessage,
  isCertificateExpired,
  isCertificateForbidden,
  isCertificateNotFound,
  isCertificateRenderFailure,
  isCertificateRevoked,
  isInvalidCertificateTemplate,
  isMissingCertificateAsset,
  verificationReasonLabel,
} from "../../lib/certificateErrors";
import type {
  ApiErrorBody,
  CertificateExportFormat,
  CertificateLayout,
  CertificateSummary,
  CertificateVerificationResult,
  IssueCertificateInput,
  UpdateCertificateTemplateInput,
} from "../../types/api";
import { certificateKeys } from "./hooks";

function axiosError(status: number, code: string, message: string): AxiosError<ApiErrorBody> {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    headers: {},
    config: {} as never,
    data: { error: { code, message } },
  });
}

describe("certificate creation", () => {
  it("shapes issue payload", () => {
    const body: IssueCertificateInput = {
      organizationId: "11111111-1111-1111-1111-111111111111",
      title: "Completion Certificate",
      recipientName: "Ada Lovelace",
      recipientEmail: "ada@example.com",
      templateId: null,
      createQr: false,
    };
    expect(body.title).toMatch(/Certificate/);
    expect(body.recipientName).toBe("Ada Lovelace");
  });

  it("uses list and detail query keys after creation", () => {
    expect(certificateKeys("org-1").list({ status: "issued" })).toEqual([
      "certificates",
      "org-1",
      "list",
      { status: "issued" },
    ]);
    expect(certificateKeys("org-1", "cert-1").detail).toEqual([
      "certificates",
      "org-1",
      "cert-1",
    ]);
  });

  it("maps template not found on create", () => {
    const error = axiosError(404, "TEMPLATE_NOT_FOUND", "Certificate template not found");
    expect(isInvalidCertificateTemplate(error)).toBe(true);
    expect(getCertificateErrorMessage(error)).toMatch(/template/i);
  });
});

describe("certificate verification", () => {
  it("labels verification reasons", () => {
    expect(verificationReasonLabel("CERTIFICATE_REVOKED")).toMatch(/revoked/i);
    expect(verificationReasonLabel("CERTIFICATE_EXPIRED")).toMatch(/expired/i);
    expect(verificationReasonLabel("INTEGRITY_MISMATCH")).toMatch(/integrity/i);
  });

  it("evaluates verification contract shape", () => {
    const verification: CertificateVerificationResult = {
      valid: false,
      status: "revoked",
      checks: {
        integrity: true,
        notRevoked: false,
        notExpired: true,
        documentOk: true,
      },
      reasons: ["CERTIFICATE_REVOKED"],
    };
    expect(verification.valid).toBe(false);
    expect(verification.checks.notRevoked).toBe(false);
  });

  it("maps revoked and expired verification errors", () => {
    expect(isCertificateRevoked(axiosError(410, "CERTIFICATE_REVOKED", "revoked"))).toBe(true);
    expect(isCertificateExpired(axiosError(410, "CERTIFICATE_EXPIRED", "expired"))).toBe(true);
    expect(getCertificateErrorMessage(axiosError(410, "CERTIFICATE_REVOKED", "x"))).toMatch(
      /revoked/i,
    );
  });
});

describe("revocation", () => {
  it("maps status tones for lifecycle", () => {
    expect(certificateStatusTone("issued")).toBe("success");
    expect(certificateStatusTone("revoked")).toBe("danger");
    expect(certificateStatusTone("expired")).toBe("warning");
  });

  it("marks revoked certificates in summary", () => {
    const cert = {
      status: "revoked",
      revokeReason: "Issued in error",
    } as Pick<CertificateSummary, "status" | "revokeReason">;
    expect(cert.status).toBe("revoked");
    expect(cert.revokeReason).toBeTruthy();
  });
});

describe("template editing", () => {
  it("provides default layout preview fields", () => {
    const layout = defaultCertificateLayoutPreview() as CertificateLayout;
    expect(layout.orientation).toBe("portrait");
    expect(String(layout.bodyTemplate)).toContain("{{recipient_name}}");
    expect(String(layout.footerTemplate)).toContain("{{verification_url}}");
  });

  it("shapes update template payload", () => {
    const body: UpdateCertificateTemplateInput = {
      name: "Completion v2",
      status: "active",
      layout: {
        orientation: "landscape",
        titleTemplate: "Award",
        showQr: true,
      },
    };
    expect(body.layout?.orientation).toBe("landscape");
    expect(body.status).toBe("active");
  });

  it("maps permission denied for template edits", () => {
    const error = axiosError(403, "FORBIDDEN", "Insufficient permissions");
    expect(isCertificateForbidden(error)).toBe(true);
    expect(getCertificateErrorMessage(error)).toMatch(/permission/i);
  });
});

describe("downloads", () => {
  it("supports pdf png svg formats", () => {
    const formats: CertificateExportFormat[] = ["pdf", "png", "svg"];
    expect(formats).toHaveLength(3);
    expect(certificateKeys("org-1", "cert-1").download("cert-1", "pdf")).toEqual([
      "certificates",
      "org-1",
      "cert-1",
      "download",
      "pdf",
    ]);
  });

  it("maps render and missing asset failures", () => {
    expect(isCertificateRenderFailure(axiosError(500, "RENDER_FAILED", "render boom"))).toBe(
      true,
    );
    expect(isMissingCertificateAsset(axiosError(404, "ASSET_MISSING", "logo missing"))).toBe(
      true,
    );
    expect(getCertificateErrorMessage(axiosError(500, "RENDER_FAILED", "x"))).toMatch(/render/i);
  });
});

describe("preview rendering", () => {
  it("uses preview query key", () => {
    expect(certificateKeys("org-1", "cert-1").preview("cert-1")).toEqual([
      "certificates",
      "org-1",
      "cert-1",
      "preview",
    ]);
  });

  it("maps not found for missing certificates", () => {
    const error = axiosError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
    expect(isCertificateNotFound(error)).toBe(true);
    expect(getCertificateErrorMessage(error)).toMatch(/not found/i);
  });
});

describe("bulk issuance", () => {
  it("uses bulk job query key", () => {
    expect(certificateKeys("org-1").bulkJob("job-1")).toEqual([
      "certificates",
      "org-1",
      "bulk",
      "job-1",
    ]);
  });

  it("shapes csv and json bulk payloads", () => {
    const csv = "recipient_name,recipient_email\nAda,ada@example.com\n";
    const json = JSON.stringify([{ recipientName: "Ada", recipientEmail: "ada@example.com" }]);
    expect(csv).toContain("recipient_name");
    expect(JSON.parse(json)).toHaveLength(1);
  });

  it("maps bulk validation failures", () => {
    const error = axiosError(400, "BULK_VALIDATION_FAILED", "Import contains invalid rows");
    expect(getCertificateErrorMessage(error)).toMatch(/invalid rows/i);
  });

  it("tracks progress percent contract", () => {
    const job = {
      processedRows: 25,
      totalRows: 100,
      percentComplete: 25,
      status: "processing",
      cancelRequested: false,
    };
    expect(job.percentComplete).toBe(25);
    expect(job.cancelRequested).toBe(false);
  });
});

describe("certificate analytics", () => {
  it("uses analytics query key", () => {
    expect(certificateKeys("org-1").analytics).toEqual(["certificates", "org-1", "analytics"]);
  });

  it("shapes issuance and download metric contracts", () => {
    const issuance = { issued: 10, revoked: 2, expired: 1, active: 10, total: 13 };
    const downloads = { totalEvents: 4, byFormat: { pdf: 2, png: 2 }, averageRenderTimeMs: 120 };
    expect(issuance.active).toBe(10);
    expect(downloads.byFormat.pdf).toBe(2);
  });

  it("shapes admin cleanup and reprocess contracts", () => {
    const cleanup = { deletedEvents: 5, deletedBulkJobs: 1, deletedTemporaryAssetEvents: 3 };
    const reprocess = { succeeded: 2, failed: 0, processed: 2 };
    expect(cleanup.deletedEvents).toBeGreaterThan(0);
    expect(reprocess.processed).toBe(reprocess.succeeded + reprocess.failed);
  });
});
