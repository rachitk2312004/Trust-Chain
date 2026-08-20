#!/usr/bin/env node
/**
 * Dev perf harness: mint a valid access token from DB, then run decompose tests.
 * Usage: node apps/backend/scripts/perf-with-session.mjs
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { performance } from "node:perf_hooks";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dir, "../.env") });

const API_BASE = process.env.API_BASE ?? "http://localhost:3002/api/v1";

function signToken(userId, sessionId) {
  const secret = process.env.JWT_ACCESS_SECRET;
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
  return jwt.sign({ sub: userId, sid: sessionId, typ: "access" }, secret, { expiresIn });
}

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
  return { label, ms, status: res.status, json, requestId: res.headers.get("x-request-id") };
}

async function main() {
  const prisma = new PrismaClient();
  const session = await prisma.session.findFirst({
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true },
  });
  if (!session) throw new Error("No active session in DB");
  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) throw new Error("No organization");
  await prisma.$disconnect();

  const token = signToken(session.userId, session.id);
  const headers = { authorization: `Bearer ${token}` };
  console.log(`API_BASE=${API_BASE} orgId=${org.id}`);

  // Warm auth cache
  await fetchTimed("warmup /me", `${API_BASE}/me`, { headers });

  console.log("\n=== Single GET /members (5 runs, warm auth) ===");
  const memberSamples = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetchTimed(`members #${i + 1}`, `${API_BASE}/organizations/${org.id}/members`, {
      headers,
    });
    memberSamples.push(r.ms);
    console.log(`  run ${i + 1}: ${r.ms.toFixed(0)}ms status=${r.status} requestId=${r.requestId}`);
  }
  console.log(`  avg: ${(memberSamples.reduce((a, b) => a + b, 0) / memberSamples.length).toFixed(0)}ms`);

  console.log("\n=== Page fan-out parallel (cold auth cache cleared by new process — first burst) ===");
  const paths = [
    ["GET /organizations", `${API_BASE}/organizations`],
    ["GET /join-requests/mine", `${API_BASE}/organizations/join-requests/mine`],
    ["GET /me", `${API_BASE}/me`],
    ["GET /organizations/:id", `${API_BASE}/organizations/${org.id}`],
    ["GET /members", `${API_BASE}/organizations/${org.id}/members`],
  ];
  const wallStart = performance.now();
  const parallel = await Promise.all(paths.map(([label, url]) => fetchTimed(label, url, { headers })));
  console.log(`  parallel wall: ${(performance.now() - wallStart).toFixed(0)}ms`);
  for (const r of parallel) {
    console.log(`  ${r.label}: ${r.ms.toFixed(0)}ms requestId=${r.requestId}`);
  }
  console.log(`  slowest: ${Math.max(...parallel.map((r) => r.ms)).toFixed(0)}ms`);

  console.log("\n=== Second fan-out (auth should be cached) ===");
  const wall2 = performance.now();
  const parallel2 = await Promise.all(paths.map(([label, url]) => fetchTimed(label, url, { headers })));
  console.log(`  parallel wall: ${(performance.now() - wall2).toFixed(0)}ms`);
  for (const r of parallel2) {
    console.log(`  ${r.label}: ${r.ms.toFixed(0)}ms requestId=${r.requestId}`);
  }
  console.log(`  slowest: ${Math.max(...parallel2.map((r) => r.ms)).toFixed(0)}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
