# Phase 1 — Trust-path integrity & security

## What changed

1. **Server-side streaming SHA-256** on version confirm (`streamSha256Object`) — constant memory; client hash is verified against the digest.
2. **Envelope encryption** metadata on `DocumentVersion`: `encrypted`, `encryptionAlgorithm`, `keyVersion`, `wrappedDek`, `iv`, `authTag`, `encryptionMetadata`.
3. **Key versioning**: `DOCUMENT_KEY_V1|V2|V3` + `DOCUMENT_ACTIVE_KEY_VERSION`.
4. **Malware adapters**: `mock` | `http` | `clamav` behind a single interface (no ClamAV coupling in documents service).
5. **Evidence immutability**: RBAC (ops admin) + service guard + PostgreSQL BEFORE UPDATE/DELETE triggers.
6. **`PUBLIC_VERIFY_SIGNING_SECRET`** required at startup — no JWT fallback.
7. **Layered rate limit**: Redis → `rate_limit_buckets` table → in-memory; applied to auth endpoints.
8. **Central RBAC**: `requireAuth` → `requireOrgMember` / `requireOpsAdmin` → controllers.

## Ops notes

- Set secrets before `node dist/index.js` or the process exits.
- Disable encryption locally with `DOCUMENT_ENCRYPTION_ENABLED=false` if keys are unset.
- Encrypted downloads use `GET .../documents/:id/content` (proxy stream), not raw R2 URLs.
- Rollback: revert commit + restore DB backup if migration `20260803010000_phase1_security` applied.

## Migration

`packages/database/prisma/migrations/20260803010000_phase1_security/`
