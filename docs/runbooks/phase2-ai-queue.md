# Phase 2 — AI Redis / queue / workers

## Step 2 (complete)

1. **Execution manager** (`services/ai/execution/`) — only public path into queues; no worker imports.
2. **Queue manager** (`services/ai/task_queue/`) — enqueue, claim, ack, nack/retry, dead-letter, reclaim.
3. **Separate queues:** `ocr`, `classification`, `extraction`, `embedding`, `fraud`, `evaluation` + DLQs.
4. **Locks / leases / retries / timeouts** on the queue backend (memory or Redis).

## Step 3 (complete)

Worker pool under `services/ai/workers/`:

| Module | Role |
|--------|------|
| `base_worker.py` | Claim → execute stub engine → ack / retry / DLQ |
| `worker_manager.py` | One worker per capability; drain / background |
| `heartbeat.py` | Lease renewal loop |
| `lease_manager.py` | workerId, leaseExpiration, heartbeatTimestamp, lastSeenAt |
| `retry_manager.py` | Retry vs dead-letter decisions |
| `timeout_manager.py` | Execution + visibility timeout |
| `lineage_manager.py` | Document → Artifact → Embedding → Inference → Review |
| `state_machine.py` | pending/processing/retrying/completed/failed/cancelled/dead_letter |
| `metrics.py` | queueDepth, activeTasks, leaseExpirations, retryCount, deadLetterCount, workerCount, averageExecutionTime |
| `executors/` | OCR, extraction, classification, embeddings, fraud, evaluation (existing stubs) |

```
Execution manager → Queue manager → Workers → stub engines → lineage/metrics
```

Workers never import blockchain, verification, Express, or frontend code. AI remains advisory only.

## Env

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Optional. When unset or unreachable, in-memory backend is used. |

## Step 4 (complete)

Adapter layer under `services/ai/adapters/`:

```
worker → executor → adapter (fallback chain) → FastAPI (/internal/*) → engine → result
```

- Clients: OCR, extraction, classification, embedding, fraud, evaluation, explainability
- Fallback: primary → secondary → stub → failure
- Health: circuit breaker, timeout/retry helper, response validation (`advisoryOnly`)
- Executors no longer import engine modules; they call `AdapterFactory` only
- Internal FastAPI routes added: `/internal/embed`, `/internal/evaluate`, `/internal/explain` (not public Express)

## Next

Step 5 — Express gateway orchestration (auth, persistence, audit).
