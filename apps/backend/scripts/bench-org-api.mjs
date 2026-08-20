#!/usr/bin/env node
/**
 * Benchmark organization API endpoints (Mac → local backend → Render PostgreSQL).
 *
 * Usage:
 *   BENCH_EMAIL=you@example.com BENCH_PASSWORD=secret node apps/backend/scripts/bench-org-api.mjs [orgId]
 *
 * Optional env:
 *   API_BASE=http://localhost:3001/api/v1
 */
import { performance } from "node:perf_hooks";

const API_BASE = process.env.API_BASE ?? "http://localhost:3001/api/v1";
const EMAIL = process.env.BENCH_EMAIL;
const PASSWORD = process.env.BENCH_PASSWORD;

async function timedFetch(label, url, init = {}) {
  const start = performance.now();
  const res = await fetch(url, init);
  const ms = performance.now() - start;
  const body = await res.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    // ignore
  }
  return { label, ms, status: res.status, json, body };
}

async function login() {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Set BENCH_EMAIL and BENCH_PASSWORD");
  }
  const result = await timedFetch("login", `${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, deviceName: "bench" }),
  });
  if (result.status !== 200 || !result.json?.accessToken) {
    throw new Error(`Login failed (${result.status}): ${result.body.slice(0, 200)}`);
  }
  return result.json.accessToken;
}

async function bench(token, orgId) {
  const headers = { authorization: `Bearer ${token}` };
  const paths = [
    ["GET /me", `${API_BASE}/me`],
    ["GET /organizations", `${API_BASE}/organizations`],
    ["GET /organizations/join-requests/mine", `${API_BASE}/organizations/join-requests/mine`],
    ["GET /organizations/:id", `${API_BASE}/organizations/${orgId}`],
    ["GET /organizations/:id/overview", `${API_BASE}/organizations/${orgId}/overview`],
    ["GET /organizations/:id/members", `${API_BASE}/organizations/${orgId}/members`],
    ["GET /organizations/:id/invitations", `${API_BASE}/organizations/${orgId}/invitations`],
    ["GET /organizations/:id/branches", `${API_BASE}/organizations/${orgId}/branches`],
    ["GET /organizations/:id/departments", `${API_BASE}/organizations/${orgId}/departments`],
  ];

  console.log("\n--- Cold auth (first request warms cache) ---");
  const cold = await timedFetch(paths[0][0], paths[0][1], { headers });
  console.log(`${cold.label}  ${cold.status}  ${cold.ms.toFixed(0)}ms`);

  console.log("\n--- Warm parallel (simulates org page fan-out) ---");
  const warmStart = performance.now();
  const results = await Promise.all(
    paths.slice(1).map(([label, url]) => timedFetch(label, url, { headers })),
  );
  const warmWall = performance.now() - warmStart;
  for (const r of results) {
    console.log(`${r.label}  ${r.status}  ${r.ms.toFixed(0)}ms`);
  }
  console.log(`\nParallel wall time: ${warmWall.toFixed(0)}ms`);

  console.log("\n--- Members endpoint (3 sequential runs) ---");
  for (let i = 1; i <= 3; i += 1) {
    const r = await timedFetch(`members run ${i}`, `${API_BASE}/organizations/${orgId}/members`, {
      headers,
    });
    const count = r.json?.members?.length ?? "?";
    console.log(`run ${i}: ${r.ms.toFixed(0)}ms  members=${count}`);
  }
}

async function main() {
  const token = await login();
  let orgId = process.argv[2];
  if (!orgId) {
    const list = await timedFetch("organizations", `${API_BASE}/organizations`, {
      headers: { authorization: `Bearer ${token}` },
    });
    orgId = list.json?.organizations?.[0]?.id;
    if (!orgId) throw new Error("No organization id — pass orgId as argv[2]");
  }
  console.log(`API_BASE=${API_BASE}`);
  console.log(`orgId=${orgId}`);
  await bench(token, orgId);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
