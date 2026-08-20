# Phase G — Search, Audit & Compliance API

## Search foundation (Step 1)

Base: `/api/v1/search`  
Auth: Bearer access token required.

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/search` | org member (or super admin) | Global keyword / exact / fuzzy search |
| GET | `/search/suggestions` | org member (or super admin) | Ranked title suggestions |
| POST | `/search/reindex` | org admin (or super admin) | Rebuild denormalized index |
| GET | `/search/status` | org admin (or super admin) | Index counts + latest job |

### Query parameters (`GET /search`)

| Param | Notes |
|-------|-------|
| `q` | Keyword query (optional; empty lists recent indexed rows) |
| `organizationId` | Required for non–super-admin |
| `entityTypes` | Comma-separated: `document,certificate,signature,user,organization,audit_event` |
| `status` | Exact status filter |
| `from` / `to` | ISO datetime filters on entity `createdAt` |
| `sort` | `relevance` \| `created_at_desc` \| `created_at_asc` \| `title_asc` |
| `limit` / `offset` | Pagination (max 100) |

### Indexed entities

Documents, certificates, signatures, users, organizations, admin audit events.

### Models

| Model | Purpose |
|-------|---------|
| `SearchIndexEntry` | Denormalized searchable fields + exact keys |
| `SearchIndexJob` | Reindex job status |

### Portal UI

| Path | Page |
|------|------|
| `/search` | Search |
| `/search/admin` | Index administration / reindex |

## Out of scope (Step 1)

- Postgres FTS / GIN tsvector
- Blockchain, certificate issuance, signature algorithms, SDK packages

---

## Audit infrastructure (Step 2)

Base: `/api/v1/audit`  
Auth: Bearer access token. Gate: org admin or super admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit` | List / filter immutable platform audit events |
| GET | `/audit/:id` | Event detail + replay position |
| GET | `/audit/timeline` | Correlation / request / resource timeline + chain check |
| POST | `/audit/export` | JSON/CSV export job |
| GET | `/audit/status` | Counts by source + latest export |

### Models

| Model | Purpose |
|-------|---------|
| `PlatformAuditEvent` | Append-only immutable events (hash chain via `previousHash`) |
| `AuditExportJob` | Export job + inline content (foundation) |

### Portal UI

| Path | Page |
|------|------|
| `/audit` | Audit explorer |
| `/audit/timeline` | Timeline / replay |

---

## Compliance engine (Step 3)

Base: `/api/v1/compliance`  
Auth: Bearer access token. Gate: org admin or super admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/compliance` | Dashboard (scores, violations, remediations) |
| GET | `/compliance/:id` | Assessment detail + rule results |
| POST | `/compliance/run` | Run framework assessment (`scheduled` supported) |
| GET | `/compliance/reports` | List generated reports |
| GET | `/compliance/frameworks` | SOC 2 / ISO 27001 / GDPR / HIPAA catalog |

### Models

| Model | Purpose |
|-------|---------|
| `ComplianceAssessment` | Assessment run |
| `ComplianceRuleResult` | Per-rule evaluation |
| `ComplianceViolation` | Failed control tracking |
| `ComplianceRemediation` | Remediation workflow |
| `ComplianceReport` | Generated report payload |

### Portal UI

| Path | Page |
|------|------|
| `/compliance` | Compliance dashboard |
| `/compliance/reports` | Reports |

---

## Evidence management (Step 4)

Base: `/api/v1/evidence`  
Auth: Bearer access token. Gate: org admin or super admin.

Separate from ops investigation `Evidence` (immutable case attachments). This module uses `ComplianceEvidence*` models for compliance collection, validation, tagging, linking, versioning, custody, and export.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/evidence` | List / filter evidence |
| POST | `/evidence` | Collect evidence (checksum + metadata + custody) |
| GET | `/evidence/:id` | Detail + versions + links + custody chain |
| PATCH | `/evidence/:id` | Tag / framework / content version update |
| POST | `/evidence/:id/link` | Link to assessment / violation / document / etc. |
| POST | `/evidence/export` | JSON/CSV export job |

### Models

| Model | Purpose |
|-------|---------|
| `ComplianceEvidence` | Evidence record (checksum, tags, frameworks) |
| `ComplianceEvidenceVersion` | Version history |
| `ComplianceEvidenceLink` | Links to compliance / audit / documents |
| `ComplianceEvidenceCustody` | Append-only chain-of-custody hash chain |
| `ComplianceEvidenceExport` | Export job + inline content |

### Portal UI

| Path | Page |
|------|------|
| `/evidence` | Evidence dashboard / collect / export |
| `/evidence/:id` | Detail, versions, links, custody |

### Out of scope (Step 4)

- Blockchain, webhooks, SDK packages, certificate issuance
- Ops investigation evidence mutation

---

## Retention & legal hold (Step 5)

Base: `/api/v1/retention`  
Auth: Bearer access token. Gate: org admin or super admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/retention/policies` | List retention policies |
| POST | `/retention/policies` | Create policy (target type + days + disposition) |
| PATCH | `/retention/policies/:id` | Update policy |
| GET | `/retention/holds` | List legal holds |
| POST | `/retention/holds` | Create legal hold |
| PATCH | `/retention/holds/:id` | Update / release hold |
| POST | `/retention/run` | Run archive/purge evaluation (`dryRun` supported) |
| GET | `/retention/status` | Counts, latest run, custody chain validity |

### Targets

`document`, `certificate`, `signature`, `audit_event`, `evidence`, `report`

### Models

| Model | Purpose |
|-------|---------|
| `RetentionPolicy` | Org policy per target type |
| `LegalHold` | Hold scopes (`all` / `target_type` / `targets`) |
| `RetentionRun` | Manual/scheduled run history |
| `RetentionArchive` | Snapshot + integrity hash |
| `RetentionCustodyEvent` | Per-target custody chain |

### Portal UI

| Path | Page |
|------|------|
| `/retention` | Retention dashboard |
| `/retention/holds` | Legal holds |

### Notes

- Audit events are archive-only (never hard-purged) to preserve chain integrity.
- Documents soft-archive (`archivedAt`) / soft-purge (`deletedAt`).
- Optional scheduler: `RETENTION_SCHEDULER_ENABLED=true`.

### Out of scope (Step 5)

- Blockchain, webhooks, SDK packages, certificate issuance

---

## Enterprise identity (Phase H Step 1)

Base: `/api/v1/enterprise`  
Auth: Bearer access token. Gate: org admin, super admin, or active delegated admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/enterprise` | Dashboard (SAML, SCIM, roles, ABAC, delegates, reviews) |
| POST | `/enterprise/saml` | Upsert SAML SSO config (+ optional access review) |
| POST | `/enterprise/scim` | Upsert SCIM config / rotate token / provision eval |
| GET | `/enterprise/roles` | List enterprise roles (with inheritance) |
| POST | `/enterprise/roles` | Create role (+ optional ABAC / delegate) |
| PATCH | `/enterprise/roles/:id` | Update role / complete review item |

### Models

| Model | Purpose |
|-------|---------|
| `EnterpriseSamlConfig` | Per-org SAML SP/IdP settings |
| `EnterpriseScimConfig` | SCIM base URL + hashed bearer token |
| `EnterpriseRole` | Org roles with parent inheritance |
| `EnterpriseAbacPolicy` | Attribute-based allow/deny rules |
| `EnterpriseDelegateAdmin` | Delegated administration grants |
| `EnterpriseAccessReview` / `Item` | Access review campaigns |

### Portal UI

| Path | Page |
|------|------|
| `/enterprise` | Enterprise identity dashboard |
| `/enterprise/roles` | Role editor |

### Out of scope (H1)

- Blockchain, webhooks, SDK packages, certificate issuance
- Full SAML ACS login handshake / live IdP round-trip

---

## Organization platform (Phase H Step 2)

Base: `/api/v1/organization` (singular — distinct from `/organizations` tenant CRUD)  
Auth: Bearer access token. Gate: org admin or super admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/organization` | Dashboard (depts, BUs, cost centers, approvals, report) |
| POST | `/organization/departments` | Create department (hierarchy + policy + ownership) |
| PATCH | `/organization/departments/:id` | Update department |
| POST | `/organization/business-units` | Create business unit (+ optional cost center) |
| PATCH | `/organization/business-units/:id` | Update business unit |
| GET | `/organization/hierarchy` | Tree + policy inheritance |
| POST | `/organization/approvals` | Create approval workflow + resolve chain |

### Models

| Model | Purpose |
|-------|---------|
| `Department` (extended) | Parent, BU, cost center, owner, policy |
| `OrgBusinessUnit` | Business unit hierarchy |
| `OrgCostCenter` | Cost allocation |
| `OrgApprovalWorkflow` / `OrgApprovalStep` | Approval chains |

### Portal UI

| Path | Page |
|------|------|
| `/organization` | Organization dashboard |
| `/organization/hierarchy` | Hierarchy + inheritance |

### Out of scope (H2)

- Blockchain, webhooks, SDK packages, certificate issuance

---

## Multi-region platform (Phase H Step 3)

Base: `/api/v1/regions`  
Auth: Bearer access token. Region create/patch: super admin. Routing/residency/failover: org admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/regions` | List platform regions |
| POST | `/regions` | Register region (optional org policy seed) |
| PATCH | `/regions/:id` | Update region status/endpoint |
| GET | `/regions/routing` | Region selection decision for org |
| POST | `/regions/failover` | Evaluate/execute failover |
| GET | `/regions/residency` | Residency compliance report |

### Models

| Model | Purpose |
|-------|---------|
| `PlatformRegion` | Deployable region catalog |
| `OrgResidencyPolicy` | Home/allowed/locked classes |
| `OrgRoutingPolicy` | home/nearest/latency/sticky |
| `OrgReplicationPolicy` | none/async/sync targets |
| `OrgFailoverPolicy` | primary/standby failover |
| `RegionFailoverEvent` | Failover audit trail |

### Portal UI

| Path | Page |
|------|------|
| `/regions` | Region dashboard |
| `/regions/residency` | Residency report |

### Out of scope (H3)

- Blockchain, webhooks, SDK packages, certificate issuance
- Live cross-region data plane / network mesh

---

## Disaster recovery (Phase H Step 4)

Base: `/api/v1/recovery`  
Auth: Bearer access token. Org admin or super admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recovery` | Recovery dashboard (policies, recent jobs, RPO) |
| POST | `/recovery/backups` | Create/update policy and run backup |
| POST | `/recovery/restores` | Validate and restore from backup |
| POST | `/recovery/failback` | Orchestrate failback to primary region |
| GET | `/recovery/status` | RPO/RTO status and continuity score |
| GET | `/recovery/reports` | Continuity reports (generates snapshot) |

### Models

| Model | Purpose |
|-------|---------|
| `RecoveryBackupPolicy` | Frequency, RPO/RTO, retention, scopes |
| `RecoveryBackupJob` | Backup artifacts with checksum/expiry |
| `RecoveryRestoreJob` | Restore runs with validation |
| `RecoveryFailbackJob` | Failback orchestration steps |
| `RecoveryContinuityReport` | Continuity score snapshots |

### Portal UI

| Path | Page |
|------|------|
| `/recovery` | Recovery dashboard |
| `/recovery/reports` | Continuity reports |

### Out of scope (H4)

- Blockchain, webhooks, SDK packages, certificate issuance
- Live backup/restore data plane or cross-region replication engines

---

## Governance platform (Phase H Step 5)

Base: `/api/v1/governance`  
Auth: Bearer access token. Org admin or super admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/governance?organizationId=` | Frameworks, policies, risks, controls, executive summary |
| POST | `/governance/policies` | Create governance policy (ownership validated) |
| PATCH | `/governance/policies/:id` | Update policy status/owner/content |
| GET | `/governance/risks` | Risk register list + portfolio scores |
| POST | `/governance/risks` | Create risk (scoring + optional control assessments) |
| PATCH | `/governance/risks/:id` | Update risk / residual scoring |
| GET | `/governance/reports` | Executive reports (generates snapshot) |

### Frameworks

SOC 2 · ISO 27001 · GDPR · HIPAA · NIST · PCI DSS

### Models

| Model | Purpose |
|-------|---------|
| `GovernancePolicy` | Framework-aligned policies with ownership |
| `GovernanceRisk` | Risk register with inherent/residual scores |
| `GovernanceControlAssessment` | Control assessment workflow results |
| `GovernanceExecutiveReport` | Executive dashboard snapshots |

### Portal UI

| Path | Page |
|------|------|
| `/governance` | Governance dashboard |
| `/governance/reports` | Executive reports |

### Out of scope (H5)

- Blockchain, webhooks, SDK packages, certificate issuance
- External GRC connectors / continuous control monitoring agents

---

## Wallet synchronization (Phase I Step 1)

Base: `/api/v1/wallets`  
Auth: Bearer access token. Org members can link/verify their own wallets. Sync requires org admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/wallets?organizationId=` | List wallets + ownership report |
| POST | `/wallets/link` | Register/link external wallet + issue challenge |
| POST | `/wallets/verify` | Issue challenge or verify ownership proof |
| PATCH | `/wallets/:id` | Update label / primary / revoke |
| GET | `/wallets/history` | Ownership history + reporting |
| POST | `/wallets/sync` | Run synchronization job |

### Supported providers

MetaMask · Coinbase Wallet · WalletConnect · Phantom

### Models

| Model | Purpose |
|-------|---------|
| `WalletLink` | Linked external wallet |
| `WalletChallenge` | Ownership challenge / proof |
| `WalletSyncJob` | Synchronization job |
| `WalletOwnershipEvent` | Ownership history trail |

### Portal UI

| Path | Page |
|------|------|
| `/wallets` | Wallet dashboard |
| `/wallets/history` | Ownership history |

### Out of scope (I1)

- Blockchain, webhooks, SDK packages, certificate issuance
- Live chain RPC / EIP-191 signature verification against network

---

## Ecosystem integrations (Phase I Step 2)

Base: `/api/v1/integrations`  
Auth: Bearer access token. Org admin or super admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/integrations?organizationId=` | Catalog + installed integrations + dashboard |
| POST | `/integrations` | Register connector instance |
| PATCH | `/integrations/:id` | Update sync policy / rotate credentials |
| POST | `/integrations/oauth` | Start or complete OAuth (`action`) |
| POST | `/integrations/sync` | Run synchronization jobs |
| GET | `/integrations/events` | Event logs + subscriptions |

### Supported connectors

| Category | Connectors |
|----------|------------|
| Identity | Okta, Auth0, Microsoft Entra ID |
| Communication | Slack, Microsoft Teams |
| Storage | Google Drive, Dropbox |
| Project | Jira, Asana |

### Models

| Model | Purpose |
|-------|---------|
| `EcosystemIntegration` | Installed connector instance |
| `IntegrationCredential` | Credential versions (hashed) |
| `IntegrationOAuthSession` | OAuth state / PKCE session |
| `IntegrationSyncJob` | Sync job runs |
| `IntegrationEventSubscription` | Event subscriptions (not webhooks) |
| `IntegrationEventLog` | Emitted integration events |

### Portal UI

| Path | Page |
|------|------|
| `/integrations` | Integration dashboard |
| `/integrations/marketplace` | Connector marketplace |

### Out of scope (I2)

- Blockchain, webhooks, SDK packages, certificate issuance
- Live OAuth token exchange against external IdPs / vendors

---

## Connector marketplace (Phase I Step 3)

Base: `/api/v1/marketplace`  
Auth: Bearer access token. Org admin or super admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/marketplace?organizationId=` | Browse listings + compatibility |
| POST | `/marketplace/connectors` | Publish connector listing + version |
| PATCH | `/marketplace/connectors/:id` | Update listing / add version |
| POST | `/marketplace/install` | Install listing (optional review) |
| GET | `/marketplace/reviews` | List reviews + aggregation |
| GET | `/marketplace/analytics` | Marketplace analytics report |

### Models

| Model | Purpose |
|-------|---------|
| `MarketplaceListing` | Published connector listing |
| `MarketplaceListingVersion` | Version + compatibility range |
| `MarketplaceInstallation` | Org install record |
| `MarketplaceReview` | Ratings and reviews |

### Portal UI

| Path | Page |
|------|------|
| `/marketplace` | Marketplace dashboard |
| `/marketplace/publisher` | Publisher console |

### Out of scope (I3)

- Blockchain, webhooks, SDK packages, certificate issuance
- Paid billing / revenue share for marketplace listings

---

## Ecosystem reputation (Phase I Step 4)

Base: `/api/v1/reputation`  
Auth: Bearer access token. Org admin or super admin.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reputation?organizationId=` | List profiles + summary |
| POST | `/reputation/score` | Score / upsert subject reputation |
| PATCH | `/reputation/:id` | Patch status / label / manual adjustment |
| GET | `/reputation/history?organizationId=` | Score history + trend |
| GET | `/reputation/alerts?organizationId=` | Fraud / anomaly alerts |
| GET | `/reputation/leaderboard?organizationId=` | Ranked leaderboard |

### Scoring domains

`organization`, `user`, `certificate`, `signature`, `wallet`, `connector`

### Models

| Model | Purpose |
|-------|---------|
| `ReputationProfile` | Subject trust / contribution / fraud / overall scores |
| `ReputationHistoryEvent` | Score snapshots over time |
| `ReputationAlert` | Fraud / anomaly alerts |

### Portal UI

| Path | Page |
|------|------|
| `/reputation` | Reputation dashboard |
| `/reputation/leaderboard` | Leaderboard |

### Out of scope (I4)

- Blockchain, webhooks, SDK packages, certificate issuance
- Live ML fraud models (foundation scoring / z-score anomaly only)

---

## Production hardening (Phase I Step 5)

Base: `/api/v1/platform`  
Auth: Bearer access token. Super admin only.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/platform/health` | Dependency health probes |
| GET | `/platform/readiness` | Readiness validation + persisted report |
| GET | `/platform/configuration` | Global platform configuration |
| PATCH | `/platform/configuration` | Upsert platform configuration entries |
| GET | `/platform/features` | Feature flags + evaluation samples |
| PATCH | `/platform/features/:id` | Update flag rollout / kill switch |
| GET | `/platform/metrics` | Metrics + tracing aggregation (`?persist=true`) |

### Health targets

`database`, `redis`, `object_storage`, `blockchain`, `notifications`, `integrations`

### Models

| Model | Purpose |
|-------|---------|
| `PlatformConfiguration` | Rate limits, tracing, maintenance, readiness gates |
| `PlatformReadinessReport` | Readiness verification history |
| `PlatformMetricSnapshot` | Persisted metrics |
| `PlatformTraceAggregate` | Aggregated span windows |
| `FeatureFlag` | Reused existing flag store |

### Portal UI

| Path | Page |
|------|------|
| `/platform` | Platform dashboard |
| `/platform/operations` | Operations (config, flags, metrics) |

### Out of scope (I5)

- Blockchain logic, certificate issuance, SDK packages
- Full APM / OpenTelemetry export (in-process span ring only)
