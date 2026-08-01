export type QrFormatVersion = "V1" | "V2" | "V3";
export type QrStatus = "active" | "revoked" | "expired" | "rotated" | "disabled";

export type QrIntegrityMeta = {
  payloadChecksum: string;
  payloadHash: string;
  signatureVersion: string;
  algorithm: string;
};

/** V1 — camera-friendly URL discovery payload. */
export type QrPayloadV1 = {
  formatVersion: "V1";
  url: string;
  qrPublicCode: string;
};

/** V2 — signed JSON for mobile clients. */
export type QrPayloadV2 = {
  formatVersion: "V2";
  url: string;
  qrPublicCode: string;
  publicVerifyCode: string | null;
  issuedAt: string;
  expiresAt: string | null;
  signature: string;
  signatureVersion: string;
  algorithm: string;
  payloadHash: string;
};

/** V3 — offline-capable proof metadata (no private data / no UUIDs). */
export type QrPayloadV3 = {
  formatVersion: "V3";
  url: string;
  qrPublicCode: string;
  publicVerifyCode: string | null;
  contentHash: string | null;
  networkName: string | null;
  transactionHash: string | null;
  blockNumber: string | null;
  issuedAt: string;
  expiresAt: string | null;
  signature: string;
  signatureVersion: string;
  algorithm: string;
  payloadHash: string;
};

export type QrPayload = QrPayloadV1 | QrPayloadV2 | QrPayloadV3;

export type QrTemplatePrintOptions = {
  printPageSize: string;
  printDpi: number;
  printMarginMm: number;
  printBleedMm: number;
  qrPerPage: number;
};

export type QrRenderOptions = {
  sizePx: number;
  errorCorrection: "L" | "M" | "Q" | "H";
  foregroundColor: string;
  backgroundColor: string;
  marginModules: number;
};
