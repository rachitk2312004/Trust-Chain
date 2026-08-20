# Phase 2 AI — Release audit (Step 9)

Final production-readiness audit. No schema or public API changes in this step.

## CI evidence (this audit run)

| Check | Result |
|-------|--------|
| `services/ai` pytest | **86 passed** |
| `@trustchain/backend` build | **passed** |
| `@trustchain/backend` test:unit (incl. Step 7 AI) | **passed** |
| Live Express↔Postgres E2E | **not run** (DB ACL denied in audit environment) |
| Full monorepo `npm run ci` | **not run** in this audit (scoped to Phase 2 AI surfaces) |

## Load baseline (memory backend)

| Metric | Value |
|--------|-------|
| Tasks | 40 |
| Processed | 40 |
| Elapsed | ~0.17 s |
| Avg execution | ~4.3 ms |
| Retry / DLQ / lease expiry | 0 / 0 / 0 |
| Workers | 6 |
| Residual queue depth | 0 |

## Release notes (Phase 2 AI consolidation)

### Summary

TrustChain AI now has a single execution path:

Client → Express → Execution client → FastAPI execution API → Execution manager → Queue manager → Workers → Adapters → Models.

Wave 9 public routes and job code prefixes are preserved. Express dual-stack stubs, `setImmediate` processing, and `RedisStub` are removed. Stub adapter fallback is CI/local only.

### Operator impact

- Production requires `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, and `REDIS_URL` (or explicit `AI_QUEUE_BACKEND=memory`).
- FastAPI must remain on a private network.
- Prefer dedicated workers with `AI_EXECUTION_DRAIN=false` in production.

### Docs

See `docs/runbooks/phase2-ai-queue.md` and `docs/api/{wave9-ai,gateway,execution,models}.md`.

## Deployment checklist

- [ ] Postgres Phase 2 AI migrations already applied (no new schemas in Step 9)
- [ ] Redis healthy (`PING`)
- [ ] `AI_SERVICE_URL` / `AI_SERVICE_TOKEN` / `AI_EXECUTION_MODE=production` set on Express
- [ ] `REDIS_URL` set on AI service (+ Express validation)
- [ ] FastAPI bound to private interface only
- [ ] `GET /internal/execution/health` green
- [ ] Authenticated `GET /api/v1/ai/health` and `/models` green
- [ ] Smoke OCR + classify on non-prod fixture
- [ ] Confirm stub fallback disabled (production mode)
- [ ] Confirm memory execution client unused
- [ ] Alerts on DLQ depth / queue depth / lease expirations

## Rollback plan

1. Redeploy previous Express + `services/ai` artifacts **together**.
2. Keep Wave 9 public routes unchanged — no client contract rollback required for Phase 2 path swap alone.
3. Retain Postgres data (no migrate-down); ledger rows remain valid.
4. Restore prior env if needed; re-validate production config gates.
5. Verify health endpoints; re-submit any stuck `processing` jobs after Redis restore if queues were wiped.

## Known limitations

1. FastAPI does not yet enforce `AI_SERVICE_TOKEN` server-side — rely on private network + Express token send until hardened.
2. Redis/memory queues are ephemeral; not sources of truth.
3. DLQ recovery is manual.
4. `InProcessExecutor` remains in tree but unwired (dev-only).
5. Full provider OCR/LLM latency not characterized in CI memory load tests.
6. Root `type-detect` dependency appears unused (monorepo hygiene; outside AI runtime path).

## Files requiring attention (post-release hardening, not Step 9 features)

| Item | Severity | Note |
|------|----------|------|
| `services/ai/api/` — no bearer validation | Medium | Add internal auth middleware in a future hardening PR |
| `services/ai/workflows/executor.py` — `InProcessExecutor` | Low | Optional delete after grace period |
| Root `package.json` `type-detect` | Low | Likely unused; clean up outside Phase 2 |
| `pyproject.toml` vs `requirements.txt` | Low | Dependencies declared only in requirements.txt |
| Live E2E with Postgres | Medium | Run in staging before prod cutover |
