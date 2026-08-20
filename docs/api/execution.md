# Internal Execution API

FastAPI surface used **only** by the Express execution client. Not a public internet API.

Base path: `/internal/execution`

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/submit` | Enqueue via Execution manager |
| GET | `/tasks/{task_id}` | Task status + result |
| POST | `/cancel/{task_id}` | Mark cancelled |
| POST | `/drain` | In-process worker drain (CI/local) |
| GET | `/health` | Queues + adapters + execution snapshot |
| GET | `/models` | Capability/model catalog |

Also available under `/internal/*` (engine helpers for adapters): OCR, extract, classify, search, fraud, embed, evaluate, explain, pipeline.

## Submit body

```json
{
  "capability": "ocr",
  "payload": { "imageData": "…", "engine": "stub" },
  "organizationId": "uuid",
  "documentId": "uuid",
  "legacyJobPublicCode": "OCR-JOB-AABBCCDD",
  "taskId": "AI-TASK-11223344",
  "maxAttempts": 3,
  "timeoutMs": 120000
}
```

Response:

```json
{
  "taskId": "AI-TASK-11223344",
  "queue": "ocr",
  "status": "pending",
  "legacyJobPublicCode": "OCR-JOB-AABBCCDD",
  "advisoryOnly": true
}
```

## Execution manager

`services/ai/execution/manager.py` is the sole enqueue gateway into queues.

- Validates capability → queue name
- Creates `QueueMessage` with task id, attempts, timeout, lineage hooks
- Never imports Express, blockchain, or verification code
- Workers are started separately (or via `/drain`)

## Queue manager

`services/ai/task_queue/` (named to avoid shadowing Python `queue`):

| Op | Behavior |
|----|----------|
| enqueue | Push to capability queue |
| claim | Requires live worker lease; moves to processing |
| ack | Complete + store result |
| nack | Retry with backoff or dead-letter |
| cancel | Set status `cancelled` |
| reclaim_expired | Visibility timeout → retry/DLQ |

Queues (isolated): `ocr`, `classification`, `extraction`, `embedding`, `fraud`, `evaluation`  
DLQs: `{queue}:dead_letter`

Backends: Redis (`REDIS_URL`) or in-memory (CI / explicit `AI_QUEUE_BACKEND=memory`).

## Auth

When `AI_SERVICE_TOKEN` is configured, Express sends `Authorization: Bearer <token>`. Production requires the token at Express startup.

## Related docs

- [`gateway.md`](./gateway.md) — public Express path
- [`../runbooks/worker-operations.md`](../runbooks/worker-operations.md)
- [`../runbooks/retry-management.md`](../runbooks/retry-management.md)
- [`../runbooks/dead-letter-recovery.md`](../runbooks/dead-letter-recovery.md)
