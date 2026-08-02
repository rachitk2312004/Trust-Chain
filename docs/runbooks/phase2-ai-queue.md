# Phase 2 — AI Redis / queue / workers / adapters / gateway

## Architecture (Step 6)

```
Client
  → Express (/api/v1/ai/*) RBAC + audit + ledger
  → Execution client (HTTP)
  → FastAPI /internal/execution/*
  → Execution manager
  → Queue manager
  → Workers
  → Adapters (primary → secondary → stub*)
  → Models / engines
```

\* Stub adapter slot is allowed only for local development, CI, and tests.
Production (`AI_EXECUTION_MODE=production` or `NODE_ENV=production`) never falls back to stub or the Express memory client.

## Steps 2–5 (complete)

| Layer | Path | Role |
|-------|------|------|
| Execution manager | `services/ai/execution/` | Sole enqueue gateway |
| Queue | `services/ai/task_queue/` | enqueue/claim/ack/nack/DLQ |
| Workers | `services/ai/workers/` | leases, retries, lineage, metrics |
| Adapters | `services/ai/adapters/` | FastAPI clients + fallback |
| Express gateway | `apps/backend/src/modules/ai/` | public Wave 9 routes → execution client |

## Step 6 (complete)

- Express dual-stack stub processors / `setImmediate` removed
- `RedisStub` removed; queue backends are memory (CI) or Redis
- Internal `/pipeline` uses ExecutionManager + worker drain (not `InProcessExecutor`)
- Every adapter result requires: `advisoryOnly`, `modelId`, `modelVersion`, `executionTimeMs`, `lineageId`, `confidence`
- Production fail-fast when missing: `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, and `REDIS_URL` or `AI_QUEUE_BACKEND=memory`

## Step 7 (complete)

Testing and hardening only (no new features / no schema or public contract changes):

| Suite | Location |
|-------|----------|
| Unit + failure + retry + load | `services/ai/tests/test_step7_hardening.py` |
| FastAPI integration (Express mapping) | `services/ai/tests/test_step7_integration.py` |
| Express gateway hardening | `apps/backend/src/modules/ai/tests/step7.unit.ts` |
| Dead-code audit | `docs/runbooks/phase2-ai-dead-code-audit.md` |

Load metrics are written to `services/ai/tests/_step7_load_results.json` during pytest.

## Env

| Variable | Purpose |
|----------|---------|
| `AI_SERVICE_URL` | FastAPI base URL (required in production) |
| `AI_SERVICE_TOKEN` | Bearer token for execution API (required in production) |
| `REDIS_URL` | Redis queue backend (required in production unless memory opted in) |
| `AI_QUEUE_BACKEND=memory` | Explicit in-process queue (non-silent prod opt-in only if set) |
| `AI_EXECUTION_MODE` | `production` / `gateway` / `development` / `test` / `ci` |
| `AI_ALLOW_STUB_FALLBACK` | default `true` outside production; ignored/false in production |
| `AI_EXECUTION_ALLOW_MEMORY` | Express memory client; forbidden in production |
| `AI_EXECUTION_DRAIN` | set `false` to skip sync drain after submit |

## Next

Step 8 — docs polish / CI packaging (not started).
