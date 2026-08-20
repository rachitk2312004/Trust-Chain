#!/usr/bin/env node
/**
 * Controlled latency tests against a running backend.
 *
 * Usage:
 *   node apps/backend/scripts/perf-decompose.mjs
 *
 * Env:
 *   API_BASE=http://localhost:3001/api/v1
 *   BENCH_EMAIL / BENCH_PASSWORD — optional, enables /members tests
 *   ORG_ID — optional organization id
 */
import { performance } from "node:perf_hooks";

const API_BASE = process.env.API_BASE ?? "http://localhost:3001/api/v1";

async function fetchTimed(label, url, init = {}) {
  const t0 = performance.now();
  const res = await fetch(url, init);
  const body = await res.text();
  const ms = performance.now() - t0;
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    // ignore
  }
  const requestId = res.headers.get("x-request-id");
  return { label, ms, status: res.status, json, requestId, body: body.slice(0, 200) };
}

async function login() {
  const email = process.env.BENCH_EMAIL;
  const password = process.env.BENCH_PASSWORD;
  if (!email || !password) return null;
  const r = await fetchTimed("login", `${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, deviceName: "perf-decompose" }),
  });
  if (r.status !== 200 || !r.json?.accessToken) {
    throw new Error(`Login failed: ${r.status} ${r.body}`);
  }
  return r.json.accessToken;
}

async function testHealthDb(runs = 5) {
  console.log("\n=== Test A: GET /health/db (warm) ===");
  await fetchTimed("warmup", `${API_BASE}/health/db`);
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const r = await fetchTimed(`health/db #${i + 1}`, `${API_BASE}/health/db`);
    samples.push(r.ms);
    console.log(`  run ${i + 1}: ${r.ms.toFixed(0)}ms  server-db=${r.json?.dbMs ?? "?"}ms  requestId=${r.requestId ?? "-"}`);
  }
  console.log(`  avg: ${(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(0)}ms`);
}

async function testMembersSequential(token, orgId, runs = 5) {
  console.log("\n=== Test B: GET /members sequential (warm auth) ===");
  const headers = { authorization: `Bearer ${token}` };
  // warm auth
  await fetchTimed("warmup /me", `${API_BASE}/me`, { headers });
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const r = await fetchTimed(`members #${i + 1}`, `${API_BASE}/organizations/${orgId}/members`, {
      headers,
    });
    samples.push(r.ms);
    console.log(`  run ${i + 1}: ${r.ms.toFixed(0)}ms  status=${r.status}  requestId=${r.requestId ?? "-"}`);
  }
  console.log(`  avg: ${(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(0)}ms`);
}

async function testPageFanout(token, orgId) {
  console.log("\n=== Test C: Page fan-out (parallel, simulates /members tab) ===");
  const headers = { authorization: `Bearer ${token}` };
  const paths = [
    ["GET /organizations", `${API_BASE}/organizations`],
    ["GET /join-requests/mine", `${API_BASE}/organizations/join-requests/mine`],
    ["GET /me", `${API_BASE}/me`],
    ["GET /organizations/:id", `${API_BASE}/organizations/${orgId}`],
    ["GET /members", `${API_BASE}/organizations/${orgId}/members`],
  ];
  const wallStart = performance.now();
  const results = await Promise.all(
    paths.map(([label, url]) => fetchTimed(label, url, { headers })),
  );
  const wallMs = performance.now() - wallStart;
  for (const r of results) {
    console.log(`  ${r.label}: ${r.ms.toFixed(0)}ms  requestId=${r.requestId ?? "-"}`);
  }
  console.log(`  parallel wall: ${wallMs.toFixed(0)}ms`);
  console.log(`  slowest endpoint: ${Math.max(...results.map((r) => r.ms)).toFixed(0)}ms`);
}

async function testConcurrentMembers(token, orgId, concurrency) {
  console.log(`\n=== Test D: ${concurrency} concurrent GET /members ===`);
  const headers = { authorization: `Bearer ${token}` };
  const wallStart = performance.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, i) =>
      fetchTimed(`members c${i + 1}`, `${API_BASE}/organizations/${orgId}/members`, { headers }),
    ),
  );
  const wallMs = performance.now() - wallStart;
  for (const r of results) {
    console.log(`  ${r.label}: ${r.ms.toFixed(0)}ms  requestId=${r.requestId ?? "-"}`);
  }
  console.log(`  wall: ${wallMs.toFixed(0)}ms  max: ${Math.max(...results.map((r) => r.ms)).toFixed(0)}ms`);
}

async function main() {
  console.log(`API_BASE=${API_BASE}`);
  await testHealthDb();

  const token = await login();
  if (!token) {
    console.log("\n(Set BENCH_EMAIL + BENCH_PASSWORD for authenticated tests)");
    return;
  }

  let orgId = process.env.ORG_ID;
  if (!orgId) {
    const list = await fetchTimed("organizations", `${API_BASE}/organizations`, {
      headers: { authorization: `Bearer ${token}` },
    });
    orgId = list.json?.organizations?.[0]?.id;
  }
  if (!orgId) throw new Error("No organization id");
  console.log(`orgId=${orgId}`);

  await testMembersSequential(token, orgId);
  await testPageFanout(token, orgId);
  for (const n of [1, 2, 5]) {
    await testConcurrentMembers(token, orgId, n);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
