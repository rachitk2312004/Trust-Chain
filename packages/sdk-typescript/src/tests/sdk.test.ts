import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, it } from "node:test";
import {
  TrustChain,
  TrustChainAuthError,
  TrustChainClient,
  paginateOffset,
  signWebhookPayload,
  verifyWebhook,
} from "../index.js";

describe("sdk authentication", () => {
  it("requires apiKey", () => {
    assert.throws(() => new TrustChain({ apiKey: "" }), /apiKey is required/);
  });

  it("sends Authorization bearer header", async () => {
    let auth: string | undefined;
    const server = createServer((req, res) => {
      auth = req.headers.authorization;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          version: "v1",
          organizationId: "00000000-0000-0000-0000-000000000001",
          authType: "api_key",
        }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    const client = new TrustChain({
      apiKey: "tc_live_testkey",
      baseUrl: `http://127.0.0.1:${addr.port}`,
    });
    const health = await client.health();
    assert.equal(health.ok, true);
    assert.equal(auth, "Bearer tc_live_testkey");
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("maps 401 to TrustChainAuthError", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "bad key" } }));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    const client = new TrustChainClient({
      apiKey: "tc_live_bad",
      baseUrl: `http://127.0.0.1:${addr.port}`,
      maxRetries: 0,
    });
    await assert.rejects(() => client.health(), TrustChainAuthError);
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });
});

describe("sdk retries", () => {
  it("retries transient 503 then succeeds", async () => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits += 1;
      if (hits < 3) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: "UNAVAILABLE", message: "busy" } }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ document: { id: "doc_1", title: "ok" } }));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    const client = new TrustChainClient({
      apiKey: "tc_live_x",
      baseUrl: `http://127.0.0.1:${addr.port}`,
      maxRetries: 3,
      retryDelayMs: 10,
    });
    const result = await client.request<{ document: { id: string } }>({
      method: "GET",
      path: "/documents/1",
    });
    assert.equal(result.document.id, "doc_1");
    assert.ok(hits >= 3);
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });
});

describe("sdk webhook verification", () => {
  it("verifies valid signatures and rejects stale timestamps", () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ type: "document.created" });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signWebhookPayload(secret, ts, body);
    const header = `t=${ts},v1=${sig}`;
    assert.equal(verifyWebhook({ secret, body, signatureHeader: header }).valid, true);
    assert.equal(
      verifyWebhook({
        secret,
        body,
        signatureHeader: header,
        nowSec: Number(ts) + 400,
      }).valid,
      false,
    );
  });
});

describe("sdk pagination", () => {
  it("iterates offset pages", async () => {
    const pages = [
      { items: [1, 2], total: 3, limit: 2, offset: 0 },
      { items: [3], total: 3, limit: 2, offset: 2 },
    ];
    let call = 0;
    const collected: number[] = [];
    for await (const item of paginateOffset({
      pageSize: 2,
      fetchPage: async (offset, limit) => {
        const page = pages[call++]!;
        assert.equal(offset, page.offset);
        assert.equal(limit, 2);
        return page;
      },
    })) {
      collected.push(item);
    }
    assert.deepEqual(collected, [1, 2, 3]);
  });
});

describe("generated clients shape", () => {
  it("exposes resource modules", () => {
    const sdk = new TrustChain({ apiKey: "tc_live_x", baseUrl: "http://127.0.0.1:9" });
    assert.ok(sdk.documents);
    assert.ok(sdk.certificates);
    assert.ok(sdk.signatures);
    assert.ok(sdk.webhooks);
    assert.equal(typeof sdk.webhooks.verify, "function");
  });
});
