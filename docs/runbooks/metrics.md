# AI metrics

Ephemeral worker/queue metrics — **not** a source of truth. Use for ops dashboards and incident response.

## Collected fields

| Metric | Meaning |
|--------|---------|
| `queueDepth` | Per-capability pending depth |
| `activeTasks` | Currently processing |
| `averageExecutionTime` | Mean adapter/worker duration (ms) |
| `retryCount` | Nack → retry transitions |
| `deadLetterCount` | Tasks moved to DLQ |
| `leaseExpirations` | Observed expired leases |
| `workerCount` | Active workers in manager |
| `completedCount` / `failedCount` | Terminal outcomes |

Implementation: `services/ai/workers/metrics.py`.

## Collection points

| Surface | How |
|---------|-----|
| FastAPI | `GET /internal/execution/health` |
| Express | `GET /api/v1/ai/health` (authenticated) proxies execution health |
| Tests | Step 7 load writes `services/ai/tests/_step7_load_results.json` (gitignored) |
| Analytics | Express `GET .../ai/analytics` — advisory counters only |

## Suggested alerts

| Condition | Severity |
|-----------|----------|
| DLQ depth > 0 sustained | Warning |
| DLQ depth rising | High |
| Queue depth growing + activeTasks=0 | High (workers down) |
| leaseExpirations rising | Warning |
| averageExecutionTime spike | Warning |
| Express health `unavailable` | High |

## Load baseline (CI memory, Step 7)

Indicative only:

- 40 tasks / 6 workers ≈ 0.08s wall
- Avg execution ≈ 2 ms (stub/local adapters)

Production Redis + real OCR/LLM will be slower — tune visibility timeout and lease TTL accordingly.

## Related

- [`worker-operations.md`](./worker-operations.md)
- [`troubleshooting.md`](./troubleshooting.md)
