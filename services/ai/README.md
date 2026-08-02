# TrustChain AI Service (Wave 9 + Phase 2 queue)

Advisory-only AI/OCR microservice. Never revokes certificates, executes blockchain transactions, mutates verification results, runs autonomous agents, or self-modifies prompts.

## Topology (Phase 2 Step 2)

```
Express (public) → Execution manager → Queue manager → Workers → stub engines
                         │
                         ▼
              Redis or in-memory backend
              queues: ocr | classification | extraction | embedding | fraud | evaluation
              + paired dead-letter queues
```

Express must never talk to workers directly. Redis is ephemeral only (queues, locks, leases, retries).

Queue package path: `services/ai/task_queue/` (named to avoid shadowing Python stdlib `queue`).
Workers: `services/ai/workers/` (Step 3) — lease, heartbeat, retry, timeout, lineage, metrics.

## Run tests

```bash
cd services/ai
pip install -r requirements.txt
PYTHONPATH=. pytest
```

## Run API

```bash
cd services/ai
pip install -r requirements.txt
PYTHONPATH=. uvicorn api.app:app --reload --port 8090
```

Health: `GET /health`  
Internal: `/internal/ocr`, `/internal/extract`, `/internal/classify`, `/internal/search`, `/internal/fraud`, `/internal/pipeline`, `/internal/jobs/{job_id}`

Optional: `REDIS_URL` for real Redis; CI defaults to in-memory queue backend.
