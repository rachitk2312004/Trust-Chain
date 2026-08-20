import assert from "node:assert/strict";
import {
  exchangeAuthorizationCode,
  getConnector,
  listConnectors,
  startOAuthFlow,
  validateOAuthCallback,
} from "../integration.oauth.js";
import {
  executeIntegrationSync,
  matchSubscriptions,
  rotateCredential,
  shouldRunSync,
} from "../integration.sync.js";
import { AppError } from "../../../lib/errors.js";

export function testConnectorRegistration(): void {
  const catalog = listConnectors();
  assert.equal(catalog.length, 9);
  assert.ok(catalog.some((c) => c.key === "okta"));
  assert.ok(catalog.some((c) => c.key === "slack"));
  assert.ok(catalog.some((c) => c.key === "jira"));

  const identity = listConnectors("identity");
  assert.equal(identity.length, 3);

  const slack = getConnector("slack");
  assert.equal(slack.authMode, "oauth");
  assert.ok(slack.eventTypes.includes("message.posted"));

  assert.throws(
    () => getConnector("unknown"),
    (err: unknown) => err instanceof AppError,
  );
}

export function testOAuthHandling(): void {
  const started = startOAuthFlow({
    connectorKey: "okta",
    clientId: "client-1",
    redirectUri: "https://app.trustchain.local/oauth/callback",
    scopes: ["openid", "profile"],
    now: new Date("2026-08-04T00:00:00.000Z"),
    ttlSeconds: 600,
  });
  assert.ok(started.authorizeUrl.includes("okta.example"));
  assert.ok(started.authorizeUrl.includes("state="));
  assert.equal(started.state.length, 48);
  assert.equal(started.expiresAt.toISOString(), "2026-08-04T00:10:00.000Z");

  const ok = validateOAuthCallback({
    expectedState: started.state,
    providedState: started.state,
    expiresAt: started.expiresAt,
    authorizationCode: "auth-code-123",
    now: new Date("2026-08-04T00:05:00.000Z"),
  });
  assert.equal(ok.valid, true);

  const bad = validateOAuthCallback({
    expectedState: started.state,
    providedState: "wrong",
    expiresAt: started.expiresAt,
    authorizationCode: "auth-code-123",
    now: new Date("2026-08-04T00:05:00.000Z"),
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.reasons.includes("state_mismatch"));

  const tokens = exchangeAuthorizationCode({
    connectorKey: "okta",
    code: "auth-code-123",
    codeVerifier: started.codeVerifier,
    redirectUri: "https://app.trustchain.local/oauth/callback",
  });
  assert.equal(tokens.accessToken.length, 64);
  assert.equal(tokens.tokenType, "Bearer");

  assert.throws(
    () =>
      startOAuthFlow({
        connectorKey: "jira",
        clientId: "x",
        redirectUri: "https://app.trustchain.local/cb",
      }),
    (err: unknown) => err instanceof AppError,
  );
}

export function testSynchronizationJobs(): void {
  assert.equal(
    shouldRunSync({
      lastSyncedAt: "2026-08-04T00:00:00.000Z",
      intervalMinutes: 60,
      now: new Date("2026-08-04T00:30:00.000Z"),
    }),
    false,
  );
  assert.equal(
    shouldRunSync({
      lastSyncedAt: "2026-08-04T00:00:00.000Z",
      intervalMinutes: 60,
      force: true,
      now: new Date("2026-08-04T00:30:00.000Z"),
    }),
    true,
  );

  const result = executeIntegrationSync({
    connectorKey: "slack",
    mode: "incremental",
    scopes: ["chat:write", "channels:read"],
    subscribedEventTypes: ["message.posted", "channel.created"],
    now: new Date("2026-08-04T00:00:00.000Z"),
  });
  assert.equal(result.status, "completed");
  assert.ok(result.recordsProcessed > 0);
  assert.ok(result.eventsEmitted.length >= 1);
}

export function testEventSubscriptions(): void {
  const matched = matchSubscriptions(
    [
      { eventType: "issue.created", enabled: true },
      { eventType: "issue.updated", enabled: false },
      { eventType: "issue.resolved", enabled: true },
    ],
    ["issue.created", "issue.updated", "issue.resolved", "other"],
  );
  assert.deepEqual(matched, ["issue.created", "issue.resolved"]);
}

export function testCredentialRotation(): void {
  const rotated = rotateCredential({
    kind: "api_key",
    connectorKey: "jira",
    previousVersion: 1,
    now: new Date("2026-08-04T00:00:00.000Z"),
  });
  assert.equal(rotated.version, 2);
  assert.ok(rotated.secret.startsWith("tc_jira_"));
  assert.equal(rotated.secretHash.length, 64);
  assert.equal(rotated.secretLast4.length, 4);
  assert.equal(rotated.rotatedAt.toISOString(), "2026-08-04T00:00:00.000Z");

  const oauthRot = rotateCredential({
    kind: "oauth_token",
    connectorKey: "slack",
    previousVersion: 3,
  });
  assert.equal(oauthRot.version, 4);
  assert.equal(oauthRot.secret.length, 64);
}
