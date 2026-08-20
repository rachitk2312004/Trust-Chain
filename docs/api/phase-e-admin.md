# Phase E — Administration Platform API

Base: `/api/v1/admin`  
Auth: Bearer access token required.  
Gate: `super_admin` role (global).

## Step 1 — foundation

Supports organization / user / role / permission administration, system configuration, and feature flags.

Does **not** include analytics or billing.

## Models

| Model | Purpose |
|-------|---------|
| `AdminAuditLog` | Platform admin audit trail (distinct from `OpsAuditEvent`) |
| `SystemConfiguration` | Global key/value configuration |
| `FeatureFlag` | Reuses Wave 10 feature flag table |
| `Role` / `RoleBinding` | Existing RBAC (roles are not stored on Membership) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dashboard` | Summary counts + recent audit |
| GET | `/admin/users` | List users (+ roles / memberships) |
| GET | `/admin/users/:userId` | User inspection (audited) |
| GET | `/admin/organizations` | List organizations |
| GET | `/admin/organizations/:organizationId` | Organization inspection (audited) |
| GET | `/admin/roles` | Role catalog + binding counts |
| POST | `/admin/roles/assign` | Assign role binding |
| POST | `/admin/roles/revoke` | Revoke role binding |
| GET | `/admin/permissions` | Capability catalog + role grants |
| PUT | `/admin/permissions` | Assign capabilities to a role |
| GET | `/admin/configuration` | System configuration |
| PATCH | `/admin/configuration` | Upsert configuration key |
| GET | `/admin/feature-flags` | List feature flags |
| POST | `/admin/feature-flags` | Create feature flag |
| PATCH | `/admin/feature-flags/:id` | Update feature flag |
| GET | `/admin/audit` | Admin audit log |

### Required Step 1 routes (minimum)

```
GET  /api/v1/admin/users
GET  /api/v1/admin/organizations
GET  /api/v1/admin/roles
GET  /api/v1/admin/permissions
GET  /api/v1/admin/configuration
POST /api/v1/admin/feature-flags
PATCH /api/v1/admin/feature-flags/:id
```

## Permission model

Capabilities are a code catalog (`AdminCapabilities`) with defaults per role. Overrides persist in `SystemConfiguration` under `admin.role_capabilities`.

## Feature flags

Shares the Wave 10 `FeatureFlag` model. Phase E exposes admin CRUD under `/admin/feature-flags` (Wave 10 also has `/features` for ops).

## Portal

| Path | Page |
|------|------|
| `/admin` | Dashboard |
| `/admin/users` | User table |
| `/admin/organizations` | Organization table |
| `/admin/permissions` | Roles + permission editor |
| `/admin/feature-flags` | Feature flag editor |

Sidebar: visible to `super_admin` only.

## Out of scope (Step 1)

- Analytics
- Billing
- Encryption / blockchain / signature algorithm changes

## Step 2 — tenant administration

Tenants are **organizations** (no separate Tenant identity table). Lifecycle + quotas hang off `Organization`.

### Models

| Model | Purpose |
|-------|---------|
| `TenantQuota` | Per-org limits + cached usage (`users`, `organizations`, `documents`, `certificates`, `signatures`, `storageBytes`) |
| `TenantLifecycleEvent` | Suspend / restore / archive / transfer history |

### Lifecycle states

`active` · `suspended` · `archived` · `transferred`  
(`disabled` is treated as `suspended` for transitions.)

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/tenants` | List tenants + quota summaries |
| POST | `/admin/tenants` | Create tenant (org + owner admin + default quotas) |
| GET | `/admin/tenants/:tenantId` | Inspect tenant, quotas, lifecycle |
| PATCH | `/admin/tenants/:tenantId` | Update name/status/parent/quotas |
| POST | `/admin/tenants/:tenantId/suspend` | Suspend |
| POST | `/admin/tenants/:tenantId/restore` | Restore to active |
| POST | `/admin/tenants/:tenantId/archive` | Archive |
| POST | `/admin/tenants/:tenantId/transfer` | Transfer ownership (+ optional reparent) |

### Portal

| Path | Page |
|------|------|
| `/admin/tenants` | Tenant list + create |
| `/admin/tenants/:tenantId` | Detail, quotas, lifecycle, transfer |

### Out of scope (Step 2)

- Analytics
- Billing

## Step 3 — portal expansion

Operational visibility for super admins: health, inspection, configuration history/rollback, and audit browsing.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/health` | DB / audit / configuration probes + process stats |
| GET | `/admin/audit` | Audit browse (filters: action, targetType, success, from, to, q) |
| GET | `/admin/inspection` | Aggregated tenant / quota / feature / audit / config inspection |
| GET | `/admin/configuration/history` | Config change history from audit meta |
| POST | `/admin/configuration/rollback` | Restore previousValue from a history audit entry |

Configuration updates now record `{ key, previousValue, newValue }` in `AdminAuditLog` (no separate history table).

### Portal

| Path | Page |
|------|------|
| `/admin/audit` | Filtered audit browser |
| `/admin/health` | Health panel |
| `/admin/inspection` | Inspection + quota/feature inspectors |
| `/admin/configuration` | Current keys, update, history, rollback |

### Out of scope (Step 3)

- Analytics
- Billing

## Step 4 — policy engine

Centralized administration policies for permission, quota, retention, workflow, feature, and organization (tenant) rules.

### Models

| Model | Purpose |
|-------|---------|
| `PolicyDefinition` | Named policy with type, priority, parent inheritance, `rulesJson` |
| `PolicyAssignment` | Assign policy to an organization (`inheritToChildren`) |
| `PolicyEvaluationEvent` | Evaluation audit trail (decision + context/result) |

Distinct from Wave 10 `OpsPolicy`.

### Policy types

`permission` · `quota` · `retention` · `workflow` · `feature` · `organization`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/policies` | List policies (+ assignments) |
| POST | `/admin/policies` | Create policy (optional assignments) |
| GET | `/admin/policies/:policyId` | Detail + recent evaluations + conflicts |
| PATCH | `/admin/policies/:policyId` | Update definition / replace assignments |
| DELETE | `/admin/policies/:policyId` | Delete policy |
| POST | `/admin/policies/evaluate` | Evaluate applicable policies for a context |

Evaluation records `PolicyEvaluationEvent`, writes admin audit, and emits notifications (`policy_evaluated` / `policy_conflict`).

### Portal

| Path | Page |
|------|------|
| `/admin/policies` | Create, list, evaluate |
| `/admin/policies/:policyId` | Edit, assign, conflicts, evaluation history |

### Out of scope (Step 4)

- Analytics
- Billing
- Automatic enforcement hooks in auth/crypto/blockchain/signature algorithms

## Step 5 — analytics, observability, retention & operations

Operational visibility for the administration platform.

### Modules

| Module | Purpose |
|--------|---------|
| `admin.analytics.ts` | Growth, lifecycle rates, policy/feature/audit/quota metrics |
| `admin.observability.ts` | In-process counters + latency rings |
| `admin.retention.ts` | Audit / policy-event / lifecycle / configuration-audit / diagnostic purge |
| `admin.operations.ts` | Reprocess (repair) + cleanup orchestration |

### Metrics

- Tenant / user / organization growth
- Suspension / restoration / transfer rates
- Policy evaluation statistics
- Feature-flag statistics
- Quota consumption
- Audit activity + configuration changes

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/analytics` | Summary analytics |
| GET | `/admin/analytics/tenants` | Tenant growth + lifecycle + quotas |
| GET | `/admin/analytics/policies` | Policy definitions + evaluation stats |
| GET | `/admin/analytics/audit` | Audit activity metrics |
| GET | `/admin/analytics/features` | Feature-flag statistics |
| POST | `/admin/operations/reprocess` | Tenant/policy/config/audit/diagnostic repair |
| POST | `/admin/operations/cleanup` | Retention cleanup (supports `dryRun`) |

### Retention

Purges aged rows only (does not delete `SystemConfiguration` or `PolicyDefinition`):

- Admin audit (general)
- Policy evaluation events
- Tenant lifecycle events
- Configuration audit actions
- Diagnostic audit actions (`health` / `inspect` / `analytics`)

### Portal

| Path | Page |
|------|------|
| `/admin/analytics` | Metrics panels + operations |

### Out of scope (Step 5)

- Billing
- Changes to authentication, encryption, blockchain, or signature algorithms
