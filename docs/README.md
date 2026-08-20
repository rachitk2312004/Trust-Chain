# TrustChain Docs

## Product delivery (start here)

| Doc | Purpose |
|-----|---------|
| [`product/PRODUCT_DELIVERY_PLAN.md`](./product/PRODUCT_DELIVERY_PLAN.md) | **Active plan** — slice order, DoD, demo scripts, code maps for finishing v1 |

- `api/` — API notes (Waves 1–10 + Phase 2 AI gateway/execution/models + Phase B–F)
- `architecture/` — layout and regenerated Wave 1 plan
- `runbooks/` — operational procedures (Phase 1 security, Phase 2 AI)

## Phase F — Developer platform

| Doc | Purpose |
|-----|---------|
| [`api/phase-f-developer.md`](./api/phase-f-developer.md) | Developer foundation (API keys, webhooks, service accounts) |

## Phase E — Administration

| Doc | Purpose |
|-----|---------|
| [`api/phase-e-admin.md`](./api/phase-e-admin.md) | Admin foundation API (users, orgs, roles, permissions, config, flags) |

## Phase 2 AI (canonical)

| Doc | Purpose |
|-----|---------|
| [`api/wave9-ai.md`](./api/wave9-ai.md) | Public AI API overview |
| [`api/gateway.md`](./api/gateway.md) | Express gateway |
| [`api/execution.md`](./api/execution.md) | Internal execution API |
| [`api/models.md`](./api/models.md) | Model catalog + result contract |
| [`runbooks/phase2-ai-queue.md`](./runbooks/phase2-ai-queue.md) | Architecture index |
| [`runbooks/deployment.md`](./runbooks/deployment.md) | Startup / shutdown / rollback |
| [`runbooks/worker-operations.md`](./runbooks/worker-operations.md) | Workers |
| [`runbooks/lease-management.md`](./runbooks/lease-management.md) | Leases / heartbeats |
| [`runbooks/retry-management.md`](./runbooks/retry-management.md) | Retries |
| [`runbooks/dead-letter-recovery.md`](./runbooks/dead-letter-recovery.md) | DLQ |
| [`runbooks/disaster-recovery.md`](./runbooks/disaster-recovery.md) | DR |
| [`runbooks/troubleshooting.md`](./runbooks/troubleshooting.md) | Triage |
| [`runbooks/metrics.md`](./runbooks/metrics.md) | Metrics |
| [`runbooks/phase2-ai-dead-code-audit.md`](./runbooks/phase2-ai-dead-code-audit.md) | Step 7 audit |
| [`runbooks/phase2-ai-release-audit.md`](./runbooks/phase2-ai-release-audit.md) | Step 9 release audit |

Stack decisions and roadmap: see repository-root `IMPLEMENTATION_PLAN.md`.
