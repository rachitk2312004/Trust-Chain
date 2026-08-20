# AI deployment

Operational readiness for Express gateway + FastAPI AI service (Phase 2 final architecture).

## Required configuration

| Variable | Required in production | Purpose |
|----------|------------------------|---------|
| `AI_SERVICE_URL` | **Yes** | FastAPI base URL (no trailing slash required; client normalizes) |
| `AI_SERVICE_TOKEN` | **Yes** | Bearer token for execution API |
| `AI_EXECUTION_MODE` | Recommended | `production` / `gateway` / `development` / `test` / `ci` |
| `AI_QUEUE_BACKEND` | Conditionally | Set `memory` only when explicitly opting into in-process queues |
| `REDIS_URL` | **Yes*** | Queue/lease/lock backend (*or* `AI_QUEUE_BACKEND=memory`) |

### Additional (non-silent prod rules)

| Variable | Notes |
|----------|-------|
| `AI_ALLOW_STUB_FALLBACK` | Ignored/false in production; default true in CI/dev |
| `AI_EXECUTION_ALLOW_MEMORY` | Memory Express client; **forbidden** in production |
| `AI_EXECUTION_DRAIN` | `false` for async workers; default sync drain for CI |
| `OPENAI_API_KEY` | Optional provider credentials |
| `NODE_ENV=production` | Implies AI production mode if `AI_EXECUTION_MODE` unset |

Express startup calls `assertAiProductionConfig()` via `assertRequiredRuntimeSecrets()`.

## Startup procedure

1. **Postgres** migrated and healthy (Phase 2 AI ledger already applied; do not invent new migrations here).
2. **Redis** up (production) — verify `PING`.
3. **Start FastAPI**

```bash
cd services/ai
pip install -r requirements.txt
export REDIS_URL=redis://…
export AI_EXECUTION_MODE=production
PYTHONPATH=. uvicorn api.app:app --host 0.0.0.0 --port 8090
```

4. **Verify internal health:** `GET http://127.0.0.1:8090/internal/execution/health`
5. **Start Express** with:

```bash
export AI_SERVICE_URL=http://ai:8090
export AI_SERVICE_TOKEN=…
export AI_EXECUTION_MODE=production
export REDIS_URL=redis://…
# AI_EXECUTION_DRAIN=false  # if dedicated workers run continuously
```

6. **Verify public health:** `GET /api/v1/ai/health` (authenticated).
7. Smoke: OCR/classify against a non-prod document fixture.

## Shutdown procedure

1. Stop Express ingress (load balancer drain).
2. Allow in-flight AI jobs to finish or cancel explicitly.
3. Stop worker processes / disable drain loops.
4. Stop FastAPI.
5. Optionally snapshot Redis queue depths before flush.

## Rollback procedure

1. Keep public Wave 9 routes unchanged — rollback is deploy skew only.
2. Redeploy previous Express + `services/ai` artifacts together (client/API must match).
3. Ensure env still satisfies production checks.
4. Confirm `GET /api/v1/ai/health` and one read-only `GET /api/v1/ai/models`.
5. Do **not** roll back database schemas as part of Step 8 ops (schemas frozen).

## Network placement

- FastAPI listens on a **private** network only.
- Express is the only public AI gateway.
- Redis is private; not a source of truth (Postgres/R2/chain/verification remain authoritative).

## Related

- [`disaster-recovery.md`](./disaster-recovery.md)
- [`troubleshooting.md`](./troubleshooting.md)
- [`../api/gateway.md`](../api/gateway.md)
