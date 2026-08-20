# AI troubleshooting

## Quick checks

| Symptom | Check |
|---------|-------|
| Express 503 `AI_SERVICE_UNAVAILABLE` | `AI_SERVICE_URL` / production memory forbid |
| Express 502 `AI_EXECUTION_ERROR` | FastAPI up? Token? Path `/internal/execution/*` |
| Startup crash production config | Missing `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, or `REDIS_URL`/`AI_QUEUE_BACKEND` |
| Jobs stuck `pending` | Drain disabled without workers? Redis down? |
| Jobs `retrying` forever | Fix adapter errors; check backoff; maxAttempts |
| `dead_letter` spike | [`dead-letter-recovery.md`](./dead-letter-recovery.md) |
| `lease expired` on claim | Heartbeat dead; restart worker |
| `advisoryOnly` validation errors | Model output missing required fields |
| Forbidden operation 403 | Client attempted revoke/blockchain/etc. |

## Queue inspection

1. `GET /internal/execution/health` → `queues`
2. Per-capability depth vs DLQ depth
3. Redis CLI (prod): keys under `tc:ai` — lists for queues, processing, DLQ, leases

## Lease inspection

- Health / worker snapshot fields: `leaseExpiration`, `heartbeatTimestamp`, `lastSeenAt`
- If `alive=false`, restart worker before expecting claims

## Worker inspection

- `WorkerManager.health()` / execution health metrics: `workerCount`, `activeTasks`, `averageExecutionTime`
- Confirm executors only import adapters (Step 4+ invariant)

## Lineage flow

```mermaid
flowchart LR
  Doc[Document] --> Art[Artifact]
  Art --> Emb[Embedding]
  Emb --> Inf[Inference]
  Inf --> Rev[Review]
```

Public codes: `LINEAGE-*` (Express/AiLineage) and `AI-ARTIFACT-*` (worker lineage manager). Express appends steps to `AiLineage.stepsJson`.

## Compatibility mapping

| Wave 9 kind | Queue | Example legacy code |
|-------------|-------|---------------------|
| ocr | ocr | `OCR-JOB-*` |
| extract | extraction | `AI-JOB-*` |
| classify | classification | `CLASSIFICATION-JOB-*` |
| search / embed | embedding | `EMBEDDING-JOB-*` |
| fraud | fraud | `AI-JOB-*` |

Phase 2 task ids: `AI-TASK-*` via `legacyJobPublicCode`.

## Security reminders

- RBAC + document ACL on every mutating/read job route
- Audit events for submit/processing/completed/failed
- FastAPI must stay private
- AI never mutates verification or chain state

## Related

- [`metrics.md`](./metrics.md)
- [`deployment.md`](./deployment.md)
- [`../api/gateway.md`](../api/gateway.md)
