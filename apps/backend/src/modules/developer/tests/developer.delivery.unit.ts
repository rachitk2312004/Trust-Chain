import assert from "node:assert/strict";
import {
  DeveloperEventTypes,
  DeveloperEventTypeList,
  WebhookDeliveryStatuses,
  WebhookSignatureToleranceSeconds,
} from "@trustchain/config";
import {
  nextBackoffMs,
  parseRetryPolicy,
  shouldDeadLetter,
  defaultRetryPolicy,
} from "../developer.retry.js";
import {
  buildSignatureHeader,
  decryptSigningSecret,
  encryptSigningSecret,
  parseWebhookSignature,
  signOutgoingWebhook,
  signWebhookBody,
  validateWebhookTimestamp,
  verifyWebhookSignature,
} from "../developer.signing.js";
import { isDeadLetterStatus } from "../developer.deadletter.js";
import { generateWebhookSecret } from "../developer.webhooks.js";

export function testWebhookSigning(): void {
  const secret = "whsec_test_secret_value";
  const timestamp = "1722686400";
  const body = JSON.stringify({ id: "evt_1", type: "document.created" });
  const signature = signWebhookBody(secret, timestamp, body);
  assert.equal(signature.length, 64);

  const header = buildSignatureHeader(timestamp, signature);
  assert.ok(header.includes("t="));
  assert.ok(header.includes("v1="));

  const parsed = parseWebhookSignature(header);
  assert.ok(parsed);
  assert.equal(parsed!.timestamp, timestamp);
  assert.equal(parsed!.signature, signature);

  assert.equal(
    verifyWebhookSignature({
      secret,
      body,
      signatureHeader: header,
      nowSec: Number(timestamp),
    }),
    true,
  );

  assert.equal(
    verifyWebhookSignature({
      secret: "wrong",
      body,
      signatureHeader: header,
      nowSec: Number(timestamp),
    }),
    false,
  );

  // Replay protection: stale timestamp rejected
  assert.equal(
    validateWebhookTimestamp(timestamp, WebhookSignatureToleranceSeconds, Number(timestamp) + 301),
    false,
  );
  assert.equal(
    validateWebhookTimestamp(timestamp, WebhookSignatureToleranceSeconds, Number(timestamp) + 10),
    true,
  );

  const enc = encryptSigningSecret(secret);
  assert.notEqual(enc, secret);
  assert.equal(decryptSigningSecret(enc), secret);

  const generated = generateWebhookSecret();
  assert.equal(decryptSigningSecret(generated.secretHash), generated.plaintext);

  const outgoing = signOutgoingWebhook(secret, { hello: "world" }, "wh_1", "dl_1");
  assert.equal(outgoing.headers["Content-Type"], "application/json");
  assert.ok(outgoing.headers["X-TrustChain-Signature"]);
  assert.equal(outgoing.headers["X-TrustChain-Webhook-Id"], "wh_1");
}

export function testWebhookRetries(): void {
  const policy = defaultRetryPolicy();
  assert.equal(policy.maxAttempts, 5);
  assert.equal(nextBackoffMs(1, policy), policy.initialDelayMs);
  assert.equal(nextBackoffMs(2, policy), policy.initialDelayMs * policy.backoffMultiplier);
  assert.ok(nextBackoffMs(20, policy) <= policy.maxDelayMs);

  const custom = parseRetryPolicy({
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10_000,
    backoffMultiplier: 2,
  });
  assert.ok(custom);
  assert.equal(shouldDeadLetter(3, custom!), true);
  assert.equal(shouldDeadLetter(2, custom!), false);
}

export function testWebhookReplayProtection(): void {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(validateWebhookTimestamp(String(now), 300, now), true);
  assert.equal(validateWebhookTimestamp(String(now - 400), 300, now), false);
  assert.equal(validateWebhookTimestamp("not-a-number", 300, now), false);

  const secret = "whsec_replay";
  const body = "{}";
  const oldTs = String(now - 400);
  const sig = signWebhookBody(secret, oldTs, body);
  assert.equal(
    verifyWebhookSignature({
      secret,
      body,
      signatureHeader: buildSignatureHeader(oldTs, sig),
      nowSec: now,
      toleranceSeconds: 300,
    }),
    false,
  );
}

export function testWebhookDeadLetters(): void {
  assert.equal(isDeadLetterStatus(WebhookDeliveryStatuses.failed), true);
  assert.equal(isDeadLetterStatus(WebhookDeliveryStatuses.success), false);
  assert.equal(isDeadLetterStatus(WebhookDeliveryStatuses.retrying), false);

  const policy = {
    maxAttempts: 2,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
  };
  assert.equal(shouldDeadLetter(1, policy), false);
  assert.equal(shouldDeadLetter(2, policy), true);
}

export function testEventPublicationTypes(): void {
  assert.ok(DeveloperEventTypeList.includes(DeveloperEventTypes.documentCreated));
  assert.ok(DeveloperEventTypeList.includes(DeveloperEventTypes.documentUpdated));
  assert.ok(DeveloperEventTypeList.includes(DeveloperEventTypes.certificateCreated));
  assert.ok(DeveloperEventTypeList.includes(DeveloperEventTypes.certificateRevoked));
  assert.ok(DeveloperEventTypeList.includes(DeveloperEventTypes.signatureCreated));
  assert.ok(DeveloperEventTypeList.includes(DeveloperEventTypes.signatureRevoked));
  assert.ok(DeveloperEventTypeList.includes(DeveloperEventTypes.tenantUpdated));
  assert.equal(DeveloperEventTypeList.length, 7);
}
