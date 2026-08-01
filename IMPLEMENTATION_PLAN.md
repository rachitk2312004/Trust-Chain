# TrustChain Implementation Plan

## 1. Architecture Summary

TrustChain is a **multi-tenant document trust cloud**: organizations issue documents; anyone can verify authenticity via hash, QR, ID, upload, or public URL; integrity is anchored on an Ethereum-compatible chain; clients include web, mobile, extension, and public API.

**Product architecture is unchanged** (modules, phases, platforms, and trust loop). Tooling and repository layout decisions below supersede earlier Docker / MinIO / raw-SQL choices.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Web Portal │  │ Mobile Apps │  │  Extension  │  │ Public API  │
│   (React)   │  │ (RN/Expo)   │  │  (MV3)      │  │  (REST)     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │
       └────────────────┴────────┬───────┴────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   API Gateway / Express │
                    │  Auth · RBAC · Rate lim │
                    └────────────┬────────────┘
         ┌───────────┬───────────┼───────────┬───────────┐
         ▼           ▼           ▼           ▼           ▼
    PostgreSQL   Cloudflare R2  Redis*     Blockchain  AI/OCR
    (Prisma)     (files only)   (optional) (Hardhat)   (optional)
```

\* Redis is optional. It must not store permanent data (cache, queues, ephemeral rate limits only).

**Core invariant:** Document bytes → content hash → on-chain record (issue / revoke / ownership). Verification always compares current hash + off-chain metadata (expiry, status) against chain state.

**Blockchain rule:** Never store complete files on-chain. Store only hashes, metadata references, signatures, timestamps, and transaction IDs.

---

## 1.1 Locked stack decisions

| Concern | Decision |
|---------|----------|
| Primary database | PostgreSQL |
| ORM / schema SoT | Prisma (`packages/database`) |
| Object storage | Cloudflare R2 |
| Cache / queues | Redis (optional; non-permanent only) |
| Email | Mailtrap **or** Gmail SMTP |
| Blockchain | Hardhat + Solidity |
| Local containers | **None** — no Docker, no Docker Compose, no MinIO |

---

## 2. Module Dependency Graph

Dependencies flow **bottom → top**. A module may not ship before its prerequisites.

| Layer | Modules | Depends on |
|-------|---------|------------|
| L0 Foundation | M16 Security, infra, DB, config | — |
| L1 Identity | M1 Auth & Identity | L0 |
| L2 Tenancy | M2 Organization | M1 |
| L3 Core content | M3 Document Management | M1, M2, M16 |
| L4 Trust core | M4 Blockchain, M5 Verification, M6 QR | M3 (+ M4↔M5 tightly coupled) |
| L5 Issuance UX | M7 Certificate Generator, M8 Digital Signature | M3, M6; M8 also M1 |
| L6 Observability | M9 Verification History, M10 Audit, M11 Search | M1–M5 |
| L7 Engagement | M12 Notifications, M13 Analytics | M5, M9; M13 also M6 |
| L8 Admin | M14 Administration | M1–M4, M10, M13 |
| L9 Clients | M18 Wallet, M21 Android, M22 iOS, M19 Extension | M5, M6, M12, M18 |
| L10 Platform | M20 Public API, M15 Enterprise, M17 AI, M23 Integrations, M24 Reputation | Stable L1–L8 APIs |

**Critical path (Phase 1):** Security → Auth → Org → Documents → Hash + Smart contracts → Verification + QR.

---

## 3. Folder Structure

Target monorepo layout (maintainable as the platform grows):

```
trustchain/
├── apps/
│   ├── backend/              # Express + TypeScript API
│   ├── web/                  # React + TypeScript + Tailwind
│   ├── mobile/               # React Native (Expo)
│   └── extension/            # Manifest V3 + React + TypeScript
├── packages/
│   ├── config/               # Shared env keys, ports, constants
│   ├── database/             # Prisma schema + migrations (DB source of truth)
│   ├── ui/                   # Shared UI primitives (web/extension as needed)
│   └── types/                # Shared TypeScript types / API DTOs
├── blockchain/               # Hardhat + Solidity
├── docs/
│   ├── api/
│   ├── architecture/
│   └── runbooks/
└── infrastructure/
    └── ci/                   # CI workflows (no local Docker Compose)
```

**Notes**

- Prisma schema and Prisma migrations live in `packages/database` and are the **database source of truth**.
- Application packages consume `@trustchain/database` (Prisma Client).
- Cloudflare R2 holds PDFs, certificates, images, QR assets, and other uploads. PostgreSQL stores keys and metadata only.
- Legacy top-level `backend/`, `web/`, `mobile/`, `extension/`, and `database/` paths are transitional until the apps/packages move is completed; this plan defines the target layout.

---

## 4. Database Plan (PostgreSQL + Prisma)

### 4.1 Multi-tenancy model

- Shared database, `organizationId` on tenant rows (Phase 1–3).
- Enforcement in middleware + Prisma queries.
- Phase 4 (M15): optional stronger isolation for enterprise.

### 4.2 Prisma as source of truth

- Models, indexes, relations, and enums are defined in `packages/database/prisma/schema.prisma`.
- Schema changes ship only via `prisma migrate`.
- No hand-written SQL migration plans for new work.
- Seeds use Prisma seed scripts when needed.

### 4.3 Core entity groups

| Domain | Primary models | Notes |
|--------|----------------|-------|
| Identity | User, Session, Device, MfaFactor, EmailToken, Role, RoleBinding | Soft-delete users; refresh tokens hashed |
| Org | Organization, Branch, Department, Membership, Invitation, OrganizationBranding, BulkImportJob | Hierarchy via parent org |
| Documents | Document, DocumentVersion, … | Metadata + content hash in Postgres; bytes in R2 |
| Chain | BlockchainAnchor, ChainTx, Revocation | Hash, tx id, timestamps, status — never file bytes |
| Verify / QR | VerificationEvent, QrCode, QrScan | |
| Certs / Sign | Template, SignatureRequest, Signature | |
| Audit / Notif | AuditLog, NotificationOutbox, … | Append-only audit |
| API / Enterprise | ApiKey, Webhook, SsoConfig, … | |
| Reputation | TrustScore (or materialized views) | Derived |

### 4.4 Required indexes (apply in Prisma schema)

- `User.email` (unique where not deleted)
- `Organization.slug` (unique)
- `Session.userId`
- `Device.userId`
- `Membership.organizationId`
- `Invitation.email`
- `EmailToken.tokenHash`
- `RoleBinding.userId`

### 4.5 Storage split

- **PostgreSQL:** metadata, hashes, RBAC, audit, analytics aggregates.
- **Cloudflare R2:** uploaded files (PDFs, images, certificates, QR assets, import CSVs).
- **Redis (optional):** ephemeral cache/queues/rate limits only — never source of truth.
- **Never store raw chain private keys in DB;** use secure secret storage for the relayer.

### 4.6 Blockchain data policy

On-chain and chain-related DB rows may contain only:

- Content hashes
- Metadata references
- Signatures
- Timestamps
- Transaction IDs / block references
- Revocation / ownership status

Never store complete documents or file payloads on the blockchain.

---

## 5. API Plan (Express + Public API)

### 5.1 Design principles

- Versioned REST: `/api/v1/...`
- Auth: JWT access + hashed refresh sessions in PostgreSQL
- Every authenticated route resolves tenant + role
- OpenAPI grows with each wave

### 5.2 API surface by phase

**Phase 1 – Core**

- Auth: register, login, logout, refresh, password reset, email verify, MFA, devices, sessions
- Orgs: CRUD org/branch/dept, invite, members, branding, bulk import
- Documents / chain APIs follow in later waves after identity/org is stable

**Phase 2 – Trust UX** — verification, QR, notifications, analytics, audit/search, certificates/signatures

**Phase 3 – Clients** — wallet, mobile, extension endpoints

**Phase 4 – Platform** — public API keys, webhooks, enterprise, AI, integrations, reputation

### 5.3 Cross-cutting

| Concern | Approach |
|---------|----------|
| Rate limiting | Prefer Postgres/app limits first; optional Redis later |
| File upload | Presigned URLs to Cloudflare R2 |
| Email | SMTP via Mailtrap (dev/staging) or Gmail SMTP (configured accounts) |
| Errors | Stable codes (`DOC_EXPIRED`, `DOC_REVOKED`, `DOC_TAMPERED`, …) |

---

## 6. Blockchain Plan

- Hardhat + Solidity on an Ethereum-compatible network
- `DocumentRegistry` (and related) store hash / status / events only
- Backend relayer for early phases
- Explorer links use transaction IDs — never file contents

---

## 7. Mobile Application Plan (M21 / M22)

Unchanged product scope: single Expo app for Android/iOS; dashboard, wallet, QR scanner, notifications, history. Lives under `apps/mobile`.

---

## 8. Browser Extension Plan (M19)

Unchanged product scope: MV3 Chrome/Edge/Firefox; verify, QR detect, trust score, chain lookup. Lives under `apps/extension`.

---

## 9. Deployment Plan

### 9.1 Environments (no local Docker Compose)

| Env | Purpose |
|-----|---------|
| Local | Managed/local PostgreSQL; Cloudflare R2 bucket; Mailtrap or Gmail SMTP; Hardhat node; optional Redis |
| Staging | Full stack + testnet + R2 + Mailtrap (or staging SMTP) |
| Production | Managed PostgreSQL, Cloudflare R2, CDN/WAF, optional Redis, mainnet/L2 |

### 9.2 Runtime topology

- API: Node/Express (hosted containers or PaaS — CI may use GitHub service containers; developers do not rely on repo Docker Compose)
- Workers: jobs for email, chain confirmations, imports
- Web: static CDN
- Mobile: Expo EAS
- Extension: store builds from CI
- Secrets: environment / secret manager

### 9.3 CI/CD gates

1. Lint / typecheck / unit tests  
2. `prisma migrate` / `prisma validate`  
3. Integration tests against CI Postgres service  
4. Staging deploy + smoke  
5. Production deploy with rollback  

---

## 10. Development Roadmap (aligned to spec phases)

### Phase 1 – Trust foundation

Auth → Organizations → Documents → Blockchain integration

### Phase 2 – Verify & operate

Verification, QR, analytics, notifications

### Phase 3 – Clients

Android, iOS, browser extension

### Phase 4 – Platform & enterprise

Public API, AI, enterprise features

---

## 11. Task Breakdown (dependency order)

### Wave 0 – Foundations

1. Monorepo under `apps/` + `packages/` (npm workspaces), env standards — **M**  
2. `packages/database` Prisma init + PostgreSQL connection — **M**  
3. Cloudflare R2 client wiring (presign/upload) — **M**  
4. Express app skeleton in `apps/backend` — **M**  
5. CI pipeline (lint/typecheck/build/prisma) — **S**  

### Wave 1 – Identity & org (regenerated — see §16)

6. Registration / login / password reset / email verify — **M**  
7. Sessions, devices, logout, refresh — **M**  
8. MFA — **M**  
9. RBAC (4 roles) — **M**  
10. Organization CRUD + hierarchy — **M**  
11. Branches / departments / members / invites — **M**  
12. Branding (R2 logos) + bulk import — **M**  

### Waves 2–7

Unchanged product sequencing (documents → chain/verify → issuance → ops → clients → platform).

---

## 12. Cross-Cutting Risks

| Risk | Mitigation |
|------|------------|
| Hash instability | Hash immutable R2 object bytes |
| Tenant isolation | Prisma queries always scoped; tests |
| Prisma drift | Schema-only changes via migrate; no parallel raw SQL |
| Redis misuse | Optional; ban permanent entities in Redis |
| Relayer / gas | L2, queues, pause switch |

---

## 13. Decision Log

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Database | PostgreSQL | Spec + relational tenancy/RBAC |
| ORM | Prisma | Schema as SoT; typed client; migrations |
| Object storage | Cloudflare R2 | Production file store; no MinIO |
| Redis | Optional | Cache/queues later; never permanent |
| Email | Mailtrap or Gmail SMTP | Simple SMTP path without local mail containers |
| Blockchain | Hardhat | Spec Ethereum-compatible tooling |
| Containers | Removed | No Docker / Compose in this repo workflow |
| Repo layout | `apps/` + `packages/` | Clearer growth path |
| Tenancy | Shared schema + org id | Faster early phases |
| Chain payload | Hash/metadata/tx only | Trust without storing files on-chain |

---

## 14. Suggested team sequencing

1. Platform + backend (Prisma + auth/org critical path)  
2. Web against stable `/api/v1`  
3. Blockchain in document/verify waves  
4. Mobile + extension after verify API freeze  
5. AI / enterprise / integrations after client revenue path  

---

## 15. Definition of Done per phase

- **Phase 1:** Issue → anchor hash on testnet → verify → revoke (files in R2; hash on-chain).  
- **Phase 2:** Public verify + QR under 3s; expiry/tamper; revoke notification.  
- **Phase 3:** Mobile scan + extension verify + wallet credential.  
- **Phase 4:** External API issue/verify; SSO pilot; OCR assist.  

---

## 16. Regenerated Wave 1 Implementation Plan

### 16.1 Goals

API-first identity and organization platform:

- Auth: register, login, logout, refresh, email verification, password reset, sessions, devices, MFA, RBAC  
- Orgs: organizations, departments, branches, invitations, branding, bulk import  
- PostgreSQL via **Prisma**  
- Files (logos, import CSVs) in **Cloudflare R2**  
- Email via **Mailtrap or Gmail SMTP**  
- Redis optional and unused for Wave 1 application logic  
- No Docker / Compose / MinIO  

### 16.2 Prisma models (Wave 1)

Define in `packages/database/prisma/schema.prisma`:

- User, Session, Device, MfaFactor, MfaLoginChallenge, EmailToken  
- Role, RoleBinding  
- Organization, Branch, Department, Membership, Invitation  
- OrganizationBranding, BulkImportJob  

Indexes (mandatory):

- users(email), organizations(slug), sessions(userId), devices(userId)  
- memberships(organizationId), invitations(email), email_tokens(tokenHash), role_bindings(userId)  

### 16.3 Ordered steps

1. **Repo layout alignment** — `apps/*`, `packages/database|config|types|ui`; workspace scripts  
2. **Prisma package** — schema + migrate + generate; seed four roles  
3. **Backend foundations** — pool via Prisma Client, errors, `/api/v1`, auth middleware stubs  
4. **Auth core** — register/login/email/password (Argon2id, SMTP)  
5. **Sessions / devices / refresh / logout** — hashed refresh in Postgres  
6. **MFA TOTP** — encrypted secrets; login challenge  
7. **RBAC** — four roles; `requireRole`; `GET /me`  
8. **Organizations + hierarchy** — creator becomes org_admin  
9. **Branches, departments, members, invitations**  
10. **Branding + R2** — logo object keys; presigned upload  
11. **Bulk import** — CSV → memberships/invites; source/error objects in R2  
12. **Verify** — unit/integration checks; CI runs `prisma migrate` + build  

### 16.4 Explicit non-goals (Wave 1)

- Documents, verification, QR, certificates, chain contracts  
- Redis-backed sessions/queues  
- MinIO / Docker Compose  
- Cloudinary  
- Web/mobile feature UIs beyond API-first backend  

### 16.5 Transition note

Earlier Wave 1 work used `node-pg-migrate` SQL and MinIO-oriented env. Going forward:

1. Prisma schema becomes authoritative.  
2. New migrations are Prisma-only.  
3. Object storage env and clients target Cloudflare R2.  
4. Docker Compose and MinIO are removed from the repository workflow.  

---

## Next build slice

1. Align monorepo to `apps/` + `packages/`  
2. Establish `packages/database` Prisma schema (Wave 1 models + indexes)  
3. Point backend data access at Prisma  
4. Point object storage at Cloudflare R2  
5. Continue product waves without changing module architecture  
