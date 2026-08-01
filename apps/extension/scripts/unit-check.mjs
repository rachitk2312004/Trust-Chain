import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { ExtensionIdPrefixes } from "@trustchain/config";

function detectCandidates(text) {
  const out = [];
  const push = (type, value) => {
    const v = value.trim();
    if (!v || out.some((c) => c.type === type && c.value === v)) return;
    out.push({ type, value: v });
  };
  for (const m of text.matchAll(/\/qr\/([^/?#]+)/gi)) push("qr_token", m[1]);
  for (const m of text.matchAll(/\/link\/([^/?#]+)/gi)) push("link_token", m[1]);
  for (const m of text.matchAll(/\bVERIFY-\d{8}-[0-9A-Fa-f]{8}\b/g))
    push("verification_code", m[0]);
  for (const m of text.matchAll(/\bPUB-VERIFY-[0-9A-Fa-f]{8}\b/gi))
    push("public_verify_code", m[0].toUpperCase());
  for (const m of text.matchAll(/\b[a-fA-F0-9]{64}\b/g)) push("hash", m[0].toLowerCase());
  return out;
}

function isExtId(value, kind) {
  const prefix = ExtensionIdPrefixes[kind];
  return new RegExp(`^${prefix}-[0-9A-F]{8}$`, "i").test(value);
}

function validateSignedReport(report) {
  const reasons = [];
  if (!report?.verificationResult) reasons.push("missing_verification_result");
  if (!report?.reportChecksum) reasons.push("missing_checksum");
  if (!report?.reportSignature) reasons.push("missing_signature");
  if (!report?.issuedAt) reasons.push("missing_issued_at");
  if (report?.expiresAt && new Date(report.expiresAt) <= new Date()) reasons.push("report_expired");
  return { ok: reasons.length === 0, reasons };
}

assert.equal(ExtensionIdPrefixes.session, "EXT-SESSION");
assert.equal(
  isExtId(`EXT-SESSION-${randomBytes(4).toString("hex").toUpperCase()}`, "session"),
  true,
);

const found = detectCandidates(`
  VERIFY-20260802-ABCDEF01
  PUB-VERIFY-ABCDEF01
  https://verify.trustchain.com/qr/tok_abc
  ${"a".repeat(64)}
`);
assert.ok(found.some((c) => c.type === "verification_code"));
assert.ok(found.some((c) => c.type === "qr_token"));
assert.ok(found.some((c) => c.type === "hash"));

assert.equal(
  validateSignedReport({
    verificationResult: "valid",
    reportChecksum: createHash("sha256").update("x").digest("hex"),
    reportSignature: "sig",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }).ok,
  true,
);

console.log("Wave 7 extension unit checks passed");
