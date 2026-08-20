# Phase F — Developer Platform API

## Portal (session auth)

Base: `/api/v1/developer`  
Auth: Bearer access token required.  
Gate: organization `org_admin` or platform `super_admin` (per `organizationId`).

## Public API (API key auth)

Base: `/api/public/v1`  
Auth: `Authorization: Bearer tc_live_***` or `tc_test_***` (API key).  
Service accounts: `Bearer sa_sec_***` when linked to an active API key.  
Headers: `Idempotency-Key` (mutations), `X-Request-Id` (tracing).

### Public endpoints

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/health` | any valid key | Health + auth context |
| GET | `/usage` | `read` or `keys` | Usage metrics + recent requests |
| POST | `/documents` | `write` | Create document metadata |
| GET | `/documents/:id` | `read` | Get document |
| POST | `/certificates` | `write` | Issue certificate (existing issuance) |
| GET | `/certificates/:id` | `read` | Get certificate |
| POST | `/signatures` | `write` | Create signature (existing algorithms) |
| GET | `/signatures/:id` | `read` | Get signature |

## Step 4 — SDK ecosystem

| Artifact | Location |
|----------|----------|
| TypeScript / JavaScript SDK | `packages/sdk-typescript` (`@trustchain/sdk`) |
| Python SDK | `packages/sdk-python` (`trustchain-sdk`) |
| OpenAPI JSON | `docs/api/openapi.json` |
| OpenAPI YAML | `docs/api/openapi.yaml` |
| OpenAPI builder | `developer.openapi.ts` |
| Codegen | `developer.codegen.ts` |

Portal OpenAPI:

- `GET /developer/openapi.json`
- `GET /developer/openapi.yaml`

SDK features: authentication, retries, idempotency headers, pagination helpers, webhook verification, typed errors.

## Models

| Model | Purpose |
|-------|---------|
| `ServiceAccount` | Org-scoped machine identity |
| `ApiKey` | Hashed API keys with scopes / rate limits |
| `WebhookEndpoint` | Endpoint + signing secret + retry policy |
| `WebhookDelivery` | Delivery attempt log |
| `ApiUsageEvent` | Public API request metrics |
| `ApiIdempotencyRecord` | Idempotency response cache |
| `DeveloperApiQuota` | Per-tenant request + resource quotas |

## Portal UI

| Path | Page |
|------|------|
| `/developer` | Dashboard |
| `/developer/keys` | API keys |
| `/developer/webhooks` | Webhooks |
| `/developer/usage` | Usage metrics |
| `/developer/analytics` | Analytics + quotas + anomalies |
| `/developer/audit` | Developer audit exploration |
| `/developer/explorer` | Request builder |
| `/developer/docs` | OpenAPI docs |
| `/developer/sdk` | SDK guide |

## Step 5 — Analytics & ops

Portal ops routes (session auth, org admin):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/developer/analytics` | Dashboard aggregation + monitoring + anomalies |
| GET | `/developer/analytics/usage` | Daily usage series |
| GET | `/developer/analytics/errors` | Failure-rate metrics |
| GET | `/developer/analytics/latency` | Latency percentiles |
| GET | `/developer/quotas` | Per-tenant quotas + utilization |
| PATCH | `/developer/quotas/:id` | Update quota limits |
| GET | `/developer/audit` | Search `developer.*` audit events |

Public API requests enforce org request quotas (in addition to per-key rate limits). Resource creates enforce max API keys / webhooks / service accounts.

Models: `DeveloperApiQuota`, `ApiUsageEvent`, `AdminAuditLog` (developer actions).

## Out of scope

- Changes to blockchain, certificate generation, signature algorithms, or SDK implementations
