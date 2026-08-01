# Wave 10 — Operational Intelligence Platform

Ops layer above TrustChain services. **Never** a trust authority.

```
Clients (admin / APIs)
        │
        ▼
Administration → Analytics → Governance → Monitoring / Alerting
        │
        ▼
TrustChain services (Waves 1–9) — read + ops metadata only
```

**Must never:** modify blockchain history; bypass verification or ACL; alter audit/evidence; modify cryptographic proofs; run autonomous admin/billing/policy enforcement.

## Identifiers

| Kind | Format |
|------|--------|
| Alert | `ALERT-XXXXXXXX` |
| Report | `REPORT-XXXXXXXX` |
| Case | `CASE-XXXXXXXX` |
| Policy | `POLICY-XXXXXXXX` |
| Feature | `FEATURE-XXXXXXXX` |
| Release | `RELEASE-XXXXXXXX` |
| Deployment | `DEPLOYMENT-XXXXXXXX` |

## States

`active` | `inactive` | `pending` | `suspended` | `archived`

## Platform scores

Every health snapshot records:

- `trustScore`
- `healthScore`
- `riskScore`
- `complianceScore`

## APIs (Express `/api/v1`)

Auth: Bearer + `org_admin` / `super_admin`.

| Method | Path |
|--------|------|
| POST | `/reports` |
| GET | `/reports/:id` |
| POST | `/alerts` |
| GET | `/alerts` |
| POST | `/investigations` |
| GET | `/investigations/:id` |
| POST | `/investigations/:id/evidence` |
| POST | `/billing/subscriptions` |
| GET | `/billing/invoices` |
| POST | `/features` |
| GET | `/features` |
| POST | `/compliance` |
| GET | `/compliance` |
| GET | `/ops/analytics/summary` |
| GET | `/ops/health` |
| POST | `/ops/governance/policies` |
| POST | `/ops/governance/policies/:id/approve` |
| POST | `/ops/deployments` |
| POST | `/ops/recovery/backups` |
| POST | `/ops/capacity` |

Evidence is **append-only**. Policies activate only after human approval; `autoEnforce` stays `false`. Subscriptions start `pending` with `autonomous: false`.

## Services

| Path | Role |
|------|------|
| `services/analytics` | Metrics + anomaly suggestions |
| `services/monitoring` | Health / tracing / logging facades |
| `services/governance` | Policies + approvals |
| `services/reporting` | Report builders |
| `services/compliance` | GDPR / SOC 2 / ISO 27001 checklists |
| `services/alerting` | Alert drafts (no auto-remediation) |
| `services/deployment` | Releases, environments, rollbacks, approvals |
| `services/recovery` | Backups / snapshots / validation |
| `services/capacity` | Storage / compute / network / forecast |
| `services/data` | Classification, lineage, retention, catalog |
| `services/discovery` | Registry, topology, dependencies, health |
| `services/secrets` | Rotation / validation / audit (refs only) |
| `services/events` | Publish / consume / replay / retention |

## Admin UI

`apps/admin` (`@trustchain/admin`) — dashboard, analytics, governance, compliance, alerts, reports, billing, health, feature-flags, investigations, settings, deployment, recovery, capacity, data, discovery, secrets, events.

```bash
npm run dev -w @trustchain/admin
```

## Ops unit checks

```bash
npx tsc -p services/tsconfig.json && node services/ops-unit-check-dist.mjs
```

## Explicit non-goals

- Autonomous administration
- Automatic policy enforcement
- Autonomous billing
- Blockchain modification
