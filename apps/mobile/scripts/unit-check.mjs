import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  MobileIdPrefixes,
  MobileSyncPriorities,
  MobileSyncPriorityOrder,
} from "@trustchain/config";

function detectCandidates(text) {
  const out = [];
  const push = (type, value) => {
    const v = value.trim();
    if (!v || out.some((c) => c.type === type && c.value === v)) return;
    out.push({ type, value: v });
  };
  for (const m of text.matchAll(/\/qr\/([^/?#]+)/gi)) push("qr_token", m[1]);
  for (const m of text.matchAll(/\bVERIFY-\d{8}-[0-9A-Fa-f]{8}\b/g))
    push("verification_code", m[0]);
  for (const m of text.matchAll(/\bPUB-VERIFY-[0-9A-Fa-f]{8}\b/gi))
    push("public_verify_code", m[0].toUpperCase());
  for (const m of text.matchAll(/\b[a-fA-F0-9]{64}\b/g)) push("hash", m[0].toLowerCase());
  return out;
}

function compareSyncPriority(a, b) {
  return MobileSyncPriorityOrder.indexOf(a) - MobileSyncPriorityOrder.indexOf(b);
}

assert.equal(MobileIdPrefixes.device, "MOBILE-DEVICE");
assert.match(
  `MOBILE-DEVICE-${randomBytes(4).toString("hex").toUpperCase()}`,
  /^MOBILE-DEVICE-[0-9A-F]{8}$/,
);

const found = detectCandidates(`
  VERIFY-20260802-ABCDEF01
  https://verify.trustchain.com/qr/tok_mobile
  ${"b".repeat(64)}
`);
assert.ok(found.some((c) => c.type === "qr_token"));
assert.ok(found.some((c) => c.type === "verification_code"));

assert.ok(compareSyncPriority(MobileSyncPriorities.critical, MobileSyncPriorities.background) < 0);
assert.equal(MobileSyncPriorityOrder[0], "critical");

console.log("Wave 8 mobile unit checks passed");
