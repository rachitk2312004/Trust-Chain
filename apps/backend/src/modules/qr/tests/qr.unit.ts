import assert from "node:assert/strict";
import { QrFormatVersions, QrIntegrity } from "@trustchain/config";
import {
  buildPayloadV1,
  buildPayloadV2,
  buildPayloadV3,
  computePayloadChecksum,
  computePayloadHash,
  evaluateQrStatus,
  generateQrPublicCode,
  verifyQrSignature,
} from "../utils/payload.js";

export function testQrPublicCodes() {
  assert.match(generateQrPublicCode("QR"), /^QR-[0-9A-F]{8}$/);
  assert.match(generateQrPublicCode("QR-TPL"), /^QR-TPL-[0-9A-F]{8}$/);
}

export function testQrPayloadVersions() {
  process.env.PUBLIC_VERIFY_SIGNING_SECRET = "test-secret-for-wave6";
  process.env.PUBLIC_VERIFY_BASE_URL = "https://verify.trustchain.com";

  const v1 = buildPayloadV1({ rawToken: "tok_abc", qrPublicCode: "QR-AAAAAAAA" });
  assert.equal(v1.payload.formatVersion, QrFormatVersions.V1);
  assert.equal(v1.wire, "https://verify.trustchain.com/qr/tok_abc");
  assert.ok(v1.integrity.payloadChecksum);
  assert.ok(v1.integrity.payloadHash);
  assert.equal(v1.integrity.signatureVersion, QrIntegrity.signatureVersion);
  assert.equal(v1.integrity.algorithm, QrIntegrity.algorithm);
  assert.equal(v1.integrity.payloadHash, computePayloadHash(v1.wire));

  const v2 = buildPayloadV2({
    rawToken: "tok_abc",
    qrPublicCode: "QR-BBBBBBBB",
    publicVerifyCode: "PUB-VERIFY-CCCCCCCC",
    expiresAt: null,
  });
  assert.equal(v2.payload.formatVersion, QrFormatVersions.V2);
  assert.ok(v2.payload.signature);
  assert.equal(
    verifyQrSignature({
      body: {
        formatVersion: v2.payload.formatVersion,
        url: v2.payload.url,
        qrPublicCode: v2.payload.qrPublicCode,
        publicVerifyCode: v2.payload.publicVerifyCode,
        issuedAt: v2.payload.issuedAt,
        expiresAt: v2.payload.expiresAt,
        signatureVersion: v2.payload.signatureVersion,
        algorithm: v2.payload.algorithm,
      },
      signature: v2.payload.signature,
    }),
    true,
  );

  const v3 = buildPayloadV3({
    rawToken: "tok_abc",
    qrPublicCode: "QR-DDDDDDDD",
    publicVerifyCode: "PUB-VERIFY-EEEEEEEE",
    contentHash: "a".repeat(64),
    networkName: "sepolia",
    transactionHash: "0xdead",
    blockNumber: "123",
    expiresAt: new Date(Date.now() + 60_000),
  });
  assert.equal(v3.payload.formatVersion, QrFormatVersions.V3);
  assert.equal(v3.payload.contentHash?.length, 64);
  assert.equal(v3.integrity.payloadChecksum, computePayloadChecksum(v3.payload));
}

export function testQrStatusEvaluation() {
  assert.equal(
    evaluateQrStatus({
      status: "active",
      expiresAt: null,
      revokedAt: null,
      disabledAt: null,
    }),
    "active",
  );
  assert.equal(
    evaluateQrStatus({
      status: "active",
      expiresAt: null,
      revokedAt: new Date(),
      disabledAt: null,
    }),
    "revoked",
  );
  assert.equal(
    evaluateQrStatus({
      status: "active",
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      disabledAt: null,
    }),
    "expired",
  );
}
