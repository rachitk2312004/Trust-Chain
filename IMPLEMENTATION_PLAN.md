# TrustChain Implementation Plan

## 1. Architecture Summary

TrustChain is a **multi-tenant document trust cloud**: organizations issue documents; anyone can verify authenticity via hash, QR, ID, upload, or public URL; integrity is anchored on an Ethereum-compatible chain; clients include web, mobile, extension, and public API.

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
    PostgreSQL   Object Store  Queue/Jobs  Blockchain  AI/OCR
    (tenant DB)  (docs/PDF)    (email/SMS) (Solidity)  (optional)
```

**Core invariant:** Document bytes → content hash → on-chain record (issue / revoke / ownership). Verification always compares current hash + off-chain metadata (expiry, status) against chain state.

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

**Reasoning:** Without identity and tenancy, documents have no owner. Without documents and hashes, blockchain and verification are empty. QR and certificate tooling are product surfaces on top of that trust loop. Mobile/extension reuse the same verification APIs. Enterprise/AI/integrations amplify an already stable core.

---

## 3. Folder Structure (expanded from spec)

```
trustchain/
├── web/                      # React + TS + Tailwind portal
│   ├── src/
│   │   ├── app/              # routes, layouts
│   │   ├── features/         # auth, orgs, docs, verify, certs, admin, analytics
│   │   ├── shared/           # UI kit, hooks, api client
│   │   └── lib/
│   └── public/
├── mobile/                   # Expo monorepo (Android + iOS)
│   ├── app/                  # Expo Router screens
│   ├── src/features/         # dashboard, wallet, scanner, history
│   └── packages/shared/      # shared types/api with web where useful
├── extension/                # Manifest V3
│   ├── src/                  # background, content, popup
│   └── manifests/            # chrome/edge/firefox variants if needed
├── backend/
│   ├── src/
│   │   ├── modules/          # one folder per domain module
│   │   ├── middleware/       # auth, rbac, rate-limit, tenant
│   │   ├── jobs/             # notifications, expiry, chain sync
│   │   ├── integrations/     # email, sms, storage, chain RPC
│   │   └── app.ts
│   └── tests/
├── blockchain/
│   ├── contracts/            # DocumentRegistry, ownership, revoke
│   ├── scripts/              # deploy, verify, seed
│   ├── test/
│   └── abis/                 # consumed by backend
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schemas/              # ERD / SQL reference
├── infrastructure/
│   ├── docker/
│   ├── k8s/ or terraform/    # choose one IaC style early
│   └── ci/
└── docs/
    ├── api/                  # OpenAPI
    ├── architecture/
    └── runbooks/
```

**Reasoning:** Spec’s top-level split is correct. Expand by **domain modules** in backend (not by CRUD verbs) so Phase 2–4 features land without reorganizing. Keep blockchain and DB as first-class packages so chain ABIs and migrations version with the app.

---

## 4. Database Plan (PostgreSQL)

### 4.1 Multi-tenancy model

- **Shared DB, `organization_id` on all tenant rows** for Phase 1–3 (simpler ops, fits SaaS).
- Row-level enforcement in middleware + DB constraints.
- Phase 4 (M15): optional schema-per-tenant or DB-per-enterprise for white-label / compliance customers.

### 4.2 Core entity groups

| Domain | Primary tables | Notes |
|--------|----------------|-------|
| Identity | `users`, `credentials`, `sessions`, `devices`, `mfa_factors`, `email_tokens`, `roles`, `role_bindings` | Soft-delete users; sessions hashed |
| Org | `organizations`, `branches`, `departments`, `memberships`, `invitations`, `branding`, `bulk_import_jobs` | Hierarchy via parent refs |
| Documents | `documents`, `document_versions`, `document_files`, `categories`, `tags`, `document_tags`, `shares`, `archives` | Content in object storage; DB stores metadata + hash |
| Chain | `blockchain_anchors`, `chain_txs`, `revocations` | Map `document_version_id` → tx hash, block, network |
| Verify / QR | `verification_events`, `qr_codes`, `qr_scans` | High write volume; partition by month later |
| Certs / Sign | `templates`, `template_assets`, `signature_requests`, `signatures` | |
| Audit / Notif | `audit_logs`, `notification_outbox`, `notification_deliveries` | Append-only audit |
| API / Enterprise | `api_keys`, `webhooks`, `webhook_deliveries`, `sso_configs`, `ip_allowlists` | |
| Reputation | `trust_scores` (or materialized views) | Derived from events |

### 4.3 Storage split

- **PostgreSQL:** metadata, hashes, RBAC, audit, analytics aggregates.
- **Object storage (S3-compatible):** PDF/DOCX/images; encrypt at rest (AES per M16).
- **Never store raw private keys in DB;** use KMS / wallet service for chain signing.

### 4.4 Indexing & search (M11)

- Phase 1–2: Postgres `ILIKE` + GIN on tags/metadata; unique indexes on `verification_id`, `content_hash`, `qr_token`.
- Phase 4: optional OpenSearch/Elastic if smart search + AI demand it (M17).

### 4.5 Complexity & risks

| Item | Complexity | Risk |
|------|------------|------|
| Tenant isolation bugs | High | Data leak across orgs — mitigate with automated tenancy tests |
| Audit volume | Medium | Table growth — partition early for `audit_logs` / `verification_events` |
| Hash uniqueness | Medium | Same file across orgs — scope unique hash per org or global with org link |
| Soft delete vs legal hold | Medium | Define retention policy before archive/restore ships |

---

## 5. API Plan (Express + Public API)

### 5.1 Design principles

- Versioned REST: `/api/v1/...`
- Auth: JWT (session) for portal/mobile; API keys for M20; SSO later (M15).
- Every authenticated route resolves **tenant + role** before handler.
- Idempotent writes for issue/revoke/anchor where possible (`Idempotency-Key`).
- OpenAPI as source of truth from Phase 1; SDKs generated in Phase 4.

### 5.2 API surface by phase

**Phase 1 – Core**
- Auth: register, login, logout, refresh, password reset, email verify, MFA enroll/verify, devices, sessions
- Orgs: CRUD org/branch/dept, invite, members, branding, bulk import
- Documents: upload, metadata, versions, archive/restore, categories/tags, share ACL
- Blockchain: anchor document, get on-chain status, revoke (admin/issuer)
- Internal health, admin bootstrap (super admin)

**Phase 2 – Trust UX**
- Verify: by ID, hash, file upload, public URL token
- QR: create static/dynamic, download, analytics
- Notifications: preferences, test send (admin)
- Analytics: verification trends, geo aggregates
- Audit/search: filtered activity and document search
- Certificates & signatures: templates, generate, signature request flows

**Phase 3 – Client-oriented**
- Wallet: list credentials, share links, temporary access
- Mobile-specific: push token register, optimized verify endpoints
- Extension: lightweight verify + trust score lookup

**Phase 4 – Platform**
- Public API keys, rate limits, webhooks
- Enterprise: SSO/LDAP/AD config, custom domains, white-label flags
- AI: OCR, duplicate/fraud hints, summaries (async jobs)
- Integrations: OAuth connectors for Drive/Gmail/etc.
- Reputation: score read APIs

### 5.3 Cross-cutting API concerns

| Concern | Approach |
|---------|----------|
| Rate limiting | Per user + per API key + per IP on public verify |
| File upload | Presigned URLs to object storage; virus scan hook (M16) |
| Public verify | Unauthenticated but heavily rate-limited; no PII leakage in responses |
| Webhooks | Signed payloads, retry with backoff, delivery log |
| Errors | Stable error codes (`DOC_EXPIRED`, `DOC_REVOKED`, `DOC_TAMPERED`) matching M5 outputs |

**Complexity:** High for upload + ACL + chain consistency. **Risk:** Public verify endpoints become abuse vectors — plan CDN/WAF and CAPTCHA thresholds early.

---

## 6. Blockchain Plan

### 6.1 Role of the chain

On-chain is the **integrity and revocation authority**, not document storage.

Store on-chain (minimal):
- Content hash (bytes32)
- Issuer / organization identifier (address or hashed org id)
- Issued timestamp (block time + optional explicit)
- Status: active / revoked
- Optional: document type code, expiry hash commitment (or keep expiry off-chain and verify off-chain after hash match)

### 6.2 Contracts (recommended)

1. **`DocumentRegistry`** — `issue(hash, metadataRef)`, `revoke(hash)`, `isValid(hash)`, events `Issued` / `Revoked`
2. **`AccessControl` / Ownable pattern** — org issuer wallets or backend relayer roles
3. Optional later: **batch issue** for certificate batch generation (M7)

### 6.3 Operational model

- **Backend-controlled relayer wallet** for Phase 1 (orgs don’t manage gas). Gas billed as SaaS usage later.
- Network: Ethereum-compatible L2 (lower cost) — decide before mainnet (e.g. Polygon, Base, or private permissioned chain for gov customers).
- Backend writes `blockchain_anchors` after confirmed tx; verification reads DB first, then optionally re-checks RPC for high-assurance mode.
- Explorer UI (M4): link tx hashes to block explorer + internal event timeline.

### 6.4 Verification engine alignment (M5)

| Result | Logic |
|--------|-------|
| Verified | Hash matches + on-chain active + not past expiry |
| Revoked | On-chain or DB revoke flag |
| Expired | Off-chain expiry (or on-chain if stored) |
| Tampered | Uploaded file hash ≠ anchored hash |

### 6.5 Complexity & risks

| Risk | Mitigation |
|------|------------|
| Gas cost / throughput | Batch txs, L2, queue anchoring async |
| Chain reorgs | Wait N confirmations before marking anchored |
| Key compromise | HSM/KMS, rotate relayer, pause contract |
| “Blockchain theater” | Keep hash + revoke as real product truth; don’t overclaim immutability of metadata |

**Complexity:** High (contracts + ops + async confirmation). Ship **testnet + local Hardhat** in Phase 1 before mainnet.

---

## 7. Mobile Application Plan (M21 / M22)

### 7.1 Strategy

- **Single Expo (React Native) codebase** for Android and iOS.
- Feature parity where possible; platform-specific: secure enclave storage, camera permissions, push (FCM/APNs).

### 7.2 Feature mapping

| Spec feature | Shared module | Notes |
|--------------|---------------|-------|
| Dashboard | Auth + org context + recent docs/verifications | After Phase 1 APIs stable |
| Wallet (M18) | Credential list, share, temp links, QR | Depends on issued docs + verify IDs |
| QR scanner | Camera → decode → verify API | Core Phase 3 MVP |
| Notifications | Push + in-app | Needs M12 |
| Verification history | M9 API | |
| Search / secure sharing | Deep links + ACL | iOS emphasis in spec; ship both |

### 7.3 Delivery order

1. Auth + session refresh + biometric unlock  
2. Public/verify flow + QR scanner (highest unique mobile value)  
3. Wallet + sharing  
4. Dashboard + history + push  
5. Polish: offline cache of last verifications, deep links from email

### 7.4 Risks

- Camera/QR reliability across devices — invest in QA matrix early.  
- Token storage security — use secure store, short-lived access tokens.  
- Drift from web API — generate shared TypeScript types from OpenAPI.

**Complexity:** Medium–High (scanner + wallet + push). Start after Phase 2 verification APIs are frozen.

---

## 8. Browser Extension Plan (M19)

### 8.1 Architecture (MV3)

- **Service worker:** API calls, caching trust scores  
- **Content script:** page QR detection, selection/right-click hooks  
- **Popup:** verify result, trust score, link to portal  

Browsers: Chrome, Edge (Chromium shared), Firefox (separate build/permissions as needed).

### 8.2 Features → implementation notes

| Feature | Approach |
|---------|----------|
| Right-click verification | Context menu on selection/link/image URL → hash or ID extract → verify API |
| QR detection | Scan images in page / canvas decode (careful with performance) |
| Trust score | Call M24 when available; until then show verification status only |
| Blockchain lookup | Display tx/explorer link from verify response |

### 8.3 Security constraints

- Minimal permissions; no broad `<all_urls>` unless required.  
- Never embed API secrets; use user session or limited public verify endpoints.  
- CSP and MV3 remote-code restrictions — no eval of remote scripts.

### 8.4 Order

1. Popup verify by ID/hash  
2. Context menu verify  
3. In-page QR detect  
4. Trust score + explorer deep link  
5. Firefox packaging  

**Complexity:** Medium. **Risk:** Store review policies and QR false positives. Depends on stable public verify API (Phase 2).

---

## 9. Deployment Plan

### 9.1 Environments

| Env | Purpose |
|-----|---------|
| Local | Docker Compose: Postgres, MinIO/S3, mailhog, chain local node |
| Staging | Full stack + testnet blockchain |
| Production | Multi-AZ app, managed Postgres, object storage, CDN, WAF |

### 9.2 Runtime topology

- **API:** containerized Node/Express behind load balancer  
- **Workers:** separate process for jobs (anchor txs, email/SMS, OCR, webhooks)  
- **Web:** static build on CDN  
- **Mobile:** Expo EAS build channels (preview/production)  
- **Extension:** store-published builds from CI artifacts  
- **Secrets:** vault/KMS; never in images  

### 9.3 CI/CD gates

1. Lint/typecheck/unit tests  
2. Contract tests + migration dry-run  
3. Integration tests against Compose  
4. Deploy staging → smoke verify endpoints  
5. Production deploy with rollback  

### 9.4 Observability & security ops

- Structured logs + audit trail retention  
- Metrics: verify latency, chain pending queue, upload failures  
- Backup: Postgres PITR + object storage versioning (M16)  
- IP allowlists for admin (M16)  

**Complexity:** High for multi-platform release trains. **Risk:** Chain RPC outages — verification must degrade gracefully using last known DB anchor state with clear UI caveats.

---

## 10. Development Roadmap (aligned to spec phases)

### Phase 1 – Trust foundation  
**Goal:** An org can register, upload a document, anchor its hash, and an admin can revoke it.

| Milestone | Outcomes | Est. complexity |
|-----------|----------|-----------------|
| M1.0 Foundation | Repo layout, CI, Compose, migrations baseline, security middleware skeleton | M |
| M1.1 Auth | Registration→MFA→sessions→RBAC roles | H |
| M1.2 Organizations | Hierarchy, invites, branding, bulk import | H |
| M1.3 Documents | Upload pipeline, versions, metadata, archive, tags | H |
| M1.4 Blockchain | Contracts, relayer, anchor/revoke, explorer basics | H |
| **Phase 1 exit** | E2E: issue → on-chain → revoke on testnet | — |

### Phase 2 – Verify & operate  
**Goal:** Anyone can verify; issuers get QR, analytics, notifications.

| Milestone | Outcomes | Est. complexity |
|-----------|----------|-----------------|
| M2.1 Verification engine | All 5 methods + 4 outcomes | H |
| M2.2 QR system | Static/dynamic, print/download, analytics | M |
| M2.3 Certs + signatures | Templates, batch PDF, multi-sign flows | H |
| M2.4 History, audit, search | Fraud alerts, searchable logs | M |
| M2.5 Notifications + analytics | Email/SMS/push hooks, reports/heatmaps | M–H |
| M2.6 Admin platform | Super-admin ops, storage/chain monitoring | M |
| **Phase 2 exit** | Public verify URL + QR on issued certificate | — |

### Phase 3 – Clients  
**Goal:** Mobile + extension as first-class verify/wallet clients.

| Milestone | Outcomes | Est. complexity |
|-----------|----------|-----------------|
| M3.1 Mobile MVP | Auth, scanner, verify, history | H |
| M3.2 Digital wallet | Credentials, share links, QR | M |
| M3.3 Mobile GA | Push, dashboard, iOS/Android store readiness | H |
| M3.4 Extension MVP→GA | Context menu, QR detect, trust display | M |
| **Phase 3 exit** | Store builds + extension listing candidates | — |

### Phase 4 – Platform & enterprise  
**Goal:** API product, AI assist, enterprise tenancy.

| Milestone | Outcomes | Est. complexity |
|-----------|----------|-----------------|
| M4.1 Public API | Keys, rate limits, OpenAPI, SDKs, webhooks | H |
| M4.2 Reputation engine | Trust/risk/fraud/activity scores | M |
| M4.3 AI layer | OCR, duplicate/fraud, smart search, summaries | H |
| M4.4 Enterprise | SSO/LDAP/AD, white-label, custom domains, multi-tenancy hardening | H |
| M4.5 Integrations | Drive/Gmail/Outlook/WhatsApp/ERP/HRMS (prioritize by customer) | H |
| **Phase 4 exit** | External integrator can issue+verify via API; enterprise pilot | — |

---

## 11. Task Breakdown (dependency order)

Complexity: **S** small · **M** medium · **H** high · **XL** extra-high  

### Wave 0 – Foundations  
1. Monorepo/tooling, env standards, Docker Compose — **M**  
2. Postgres schema v1 + migration tooling — **M**  
3. Object storage + AES encryption strategy — **M**  
4. Express app skeleton, logging, error model, tenancy middleware — **M**  
5. CI pipeline (test + lint) — **S**  

### Wave 1 – Identity & org  
6. User registration/login/password reset/email verify — **M**  
7. Sessions, devices, logout — **M**  
8. MFA — **M**  
9. RBAC (4 roles) — **M**  
10. Organization CRUD + hierarchy — **M**  
11. Branches/departments/employees/invites — **M**  
12. Branding + bulk import — **M**  

### Wave 2 – Documents  
13. Upload (PDF/image/DOCX) + malware scan hook — **H**  
14. Metadata, categories, tags, search (basic) — **M**  
15. Version history, archive/restore, expiry — **M**  
16. Sharing controls — **M**  

### Wave 3 – Chain & verify core  
17. Hash pipeline (canonicalization rules for DOCX/PDF) — **H**  
18. Smart contracts + tests + deploy scripts — **H**  
19. Anchor + revoke workers + confirmation watcher — **H**  
20. Verification engine (ID/hash/file/URL) — **H**  
21. QR static/dynamic + embed in docs — **M**  

### Wave 4 – Issuance product  
22. Certificate templates + drag-drop editor — **XL**  
23. Watermark, QR embed, PDF export, batch — **H**  
24. Digital signature requests/validation/multi-sign — **H**  

### Wave 5 – Ops & insight  
25. Verification history + geo/device — **M**  
26. Audit log system — **M**  
27. Advanced search — **M**  
28. Notifications (email → SMS → push) — **H**  
29. Analytics platform — **H**  
30. Admin platform — **M**  

### Wave 6 – Clients  
31. Wallet APIs — **M**  
32. Mobile app shells + auth — **M**  
33. Mobile QR verify + history — **H**  
34. Mobile wallet + sharing + push — **H**  
35. Extension MV3 verify flows — **M**  
36. Extension QR detection + packaging — **M**  

### Wave 7 – Platform  
37. Public API keys, rate limits, docs, webhooks — **H**  
38. Reputation scores — **M**  
39. AI OCR + fraud/duplicate + assistant — **XL**  
40. SSO/LDAP/AD + white-label + custom domains — **XL**  
41. Integrations (prioritized backlog) — **XL**  

---

## 12. Cross-Cutting Risks (program level)

| Risk | Impact | Why it matters | Mitigation |
|------|--------|----------------|------------|
| Hash instability (PDF/DOCX non-determinism) | Critical | False “tampered” results destroy trust | Define canonical hash inputs; prefer hashing stored immutable bytes, not re-export |
| Premature multi-platform scope | High | Dilutes Phase 1 | Freeze web+API+chain first; mobile only after verify API stable |
| Relayer key / gas economics | High | Outage or cost blowup | Queue, budgets, pause switch, L2 choice |
| Tenant data isolation | Critical | Enterprise deal-breaker | Mandatory integration tests per query path |
| Certificate editor scope | High | Can consume Phase 2 alone | Ship template-based generation before full drag-drop |
| AI/OCR accuracy expectations | Medium | Support burden | Position as assistive; human review for fraud flags |
| Integration explosion (M23) | Medium | Never-ending surface | Customer-driven priority; webhook-first generic pattern |

---

## 13. Decision Log (recommended defaults)

| Decision | Recommendation | Reasoning |
|----------|----------------|-----------|
| Tenancy | Shared schema + `organization_id` first | Faster Phase 1; isolate later for enterprise |
| Chain | L2 testnet → production L2 | Cost and throughput for document volume |
| Issuance signing | Backend relayer Phase 1 | Removes wallet UX friction for universities/HR |
| Mobile | Expo unified app | Spec lists both OS; one team can ship both |
| Search | Postgres first | Avoid ops cost until AI/smart search needs it |
| Cert editor | Templates MVP → drag-drop later | Reduces XL risk on critical path |
| Public verify | Separate edge-friendly service path | Protects core API from scrape/abuse |
| Integrations | Webhooks before deep Gmail/Drive | M20 webhooks unlock many workflows without OAuth sprawl |

---

## 14. Suggested team sequencing (staffing lens)

1. **Platform + backend** owns Waves 0–3 (critical path).  
2. **Web** parallels Auth/Org/Docs UI as APIs land.  
3. **Blockchain** engineer embeds in Wave 3, then support mode.  
4. **Mobile + extension** start at end of Phase 2 (API freeze).  
5. **AI / enterprise / integrations** only after Phase 3 revenue path exists.

---

## 15. Definition of Done per phase (acceptance)

- **Phase 1:** Org admin uploads PDF → hash anchored on testnet → second party sees Valid → admin revokes → shows Revoked. Audit log entries exist.  
- **Phase 2:** Public verify URL + QR on issued certificate verifies in under 3s; expiry and tamper paths covered; notification on revoke; basic analytics dashboard.  
- **Phase 3:** Android/iOS scan QR to same result as web; extension verifies page hash/ID; wallet holds issued credential.  
- **Phase 4:** Third party issues via API key; webhook on verify; one SSO enterprise pilot; OCR extracts fields into metadata.

---

## Next build slice

When implementation starts, the first build slice should be **Wave 0 + Auth (tasks 1–9)** with no mobile/extension/AI work until the document→hash→chain loop exists.

This plan stays within the two specification files: 24 modules, four phases, stated stack, and the `trustchain/` top-level layout — expanded only where needed for dependency order, data, APIs, chain, clients, and deployment.
