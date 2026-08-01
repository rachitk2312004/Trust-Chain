import assert from "node:assert/strict";
import { ExtensionIdPrefixes } from "@trustchain/config";
import { detectCandidates } from "../utils/detectors.js";
import { isExtId } from "../utils/ids.js";
import { trustBadge, validateSignedReport } from "../security/signatures/reportValidation.js";
import { formatCacheAge } from "../utils/time.js";

export function testExtIdFormats() {
  assert.equal(ExtensionIdPrefixes.session, "EXT-SESSION");
  assert.equal(ExtensionIdPrefixes.cache, "EXT-CACHE");
  assert.equal(ExtensionIdPrefixes.event, "EXT-EVENT");
  assert.equal(isExtId("EXT-SESSION-AABBCCDD", "session"), true);
  assert.equal(isExtId("EXT-CACHE-11223344", "cache"), true);
  assert.equal(isExtId("bad", "session"), false);
}

export function testDetectors() {
  const text = `
    VERIFY-20260802-ABCDEF01
    PUB-VERIFY-ABCDEF01
    https://verify.trustchain.com/qr/tok_abc
    https://verify.trustchain.com/link/rawtoken
    ${"a".repeat(64)}
  `;
  const found = detectCandidates(text, "page");
  assert.ok(found.some((c) => c.type === "verification_code"));
  assert.ok(found.some((c) => c.type === "public_verify_code"));
  assert.ok(found.some((c) => c.type === "qr_token" && c.value === "tok_abc"));
  assert.ok(found.some((c) => c.type === "link_token"));
  assert.ok(found.some((c) => c.type === "hash"));
}

export function testReportValidation() {
  const bad = validateSignedReport({ verificationResult: "valid" });
  assert.equal(bad.ok, false);
  const good = validateSignedReport({
    verificationResult: "valid",
    reportChecksum: "abc",
    reportSignature: "def",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(good.ok, true);
  assert.equal(trustBadge("revoked"), "Revoked");
  assert.equal(trustBadge("valid"), "Trusted");
}

export function testCacheAgeFormat() {
  const age = formatCacheAge(new Date(Date.now() - 5_000).toISOString());
  assert.match(age, /s ago$/);
}
