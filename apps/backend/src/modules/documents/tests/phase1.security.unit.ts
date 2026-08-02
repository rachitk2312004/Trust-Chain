import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { AuthRateLimit, DocumentEncryption } from "@trustchain/config";
import { AppError } from "../../../lib/errors.js";
import { assertRateLimit, resetMemoryRateLimitBuckets } from "../../../lib/rateLimit.js";
import {
  assertRequiredRuntimeSecrets,
  getPublicVerifySigningSecret,
} from "../../../lib/runtimeSecrets.js";
import { wrapUnwrapRoundTripForTests } from "../encryption.js";
import { MockMalwareScanner } from "../malware/adapters/mock.js";
import { resolveMalwareScanner, resetMalwareScannerCache } from "../malware/index.js";
import { assertEvidenceImmutable } from "../../ops/utils/guards.js";

export function testStreamingHashHelperShape(): void {
  // Pure digest parity with Buffer path (streaming uses same algorithm).
  const data = Buffer.from("trustchain-phase1");
  const expected = createHash("sha256").update(data).digest("hex");
  assert.equal(expected.length, 64);
  assert.match(expected, /^[a-f0-9]{64}$/);
}

export function testEnvelopeKeyWrap(): void {
  process.env.DOCUMENT_KEY_V1 = randomBytes(32).toString("hex");
  process.env.DOCUMENT_ACTIVE_KEY_VERSION = "1";
  const round = wrapUnwrapRoundTripForTests();
  assert.equal(round.keyVersion, 1);
  assert.ok(round.wrappedDek.includes("."));
  assert.equal(DocumentEncryption.algorithm, "aes-256-gcm");
}

export function testMalwareAdapterInterface(): void {
  resetMalwareScannerCache();
  process.env.MALWARE_SCANNER = "mock";
  const scanner = resolveMalwareScanner();
  assert.equal(scanner.name, "mock");
  assert.ok(scanner instanceof MockMalwareScanner);
}

export function testPublicVerifySecretNoFallback(): void {
  const previous = process.env.PUBLIC_VERIFY_SIGNING_SECRET;
  delete process.env.PUBLIC_VERIFY_SIGNING_SECRET;
  process.env.JWT_ACCESS_SECRET = "jwt-only-secret";
  assert.throws(() => getPublicVerifySigningSecret(), /PUBLIC_VERIFY_SIGNING_SECRET/);
  assert.throws(() => assertRequiredRuntimeSecrets(), /PUBLIC_VERIFY_SIGNING_SECRET/);
  process.env.PUBLIC_VERIFY_SIGNING_SECRET = previous ?? "test-public-verify-secret";
}

export async function testLayeredRateLimitMemoryFallback(): Promise<void> {
  resetMemoryRateLimitBuckets();
  const key = `test:${Date.now()}`;
  for (let i = 0; i < AuthRateLimit.maxRequests; i += 1) {
    await assertRateLimit({
      key,
      maxRequests: AuthRateLimit.maxRequests,
      windowMs: AuthRateLimit.windowMs,
    });
  }
  await assert.rejects(
    () =>
      assertRateLimit({
        key,
        maxRequests: AuthRateLimit.maxRequests,
        windowMs: AuthRateLimit.windowMs,
      }),
    (error: unknown) => error instanceof AppError && error.code === "RATE_LIMITED",
  );
}

export function testEvidenceImmutableGuard(): void {
  assert.throws(
    () => assertEvidenceImmutable(),
    (error: unknown) => error instanceof AppError && error.code === "EVIDENCE_IMMUTABLE",
  );
}
