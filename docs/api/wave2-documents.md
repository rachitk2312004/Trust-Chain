# Wave 2 API — Document Management

Base path: `/api/v1`

All routes require `Authorization: Bearer <access_token>` and organization membership (or `super_admin`).

Document lifecycle statuses:

| Status | Meaning |
|--------|---------|
| `pending_upload` | Created; no confirmed version yet (not a valid issued document) |
| `draft` | At least one version confirmed; not active |
| `active` | Current working document |
| `archived` | Archived (no new uploads) |
| `expired` | Past `expiresAt` (evaluated on read / expiration updates) |

Object storage: **Cloudflare R2 only**. PostgreSQL (Prisma) is the source of truth for metadata.

## Categories & tags

| Method | Path | Notes |
|--------|------|-------|
| POST/GET | `/organizations/:id/document-categories` | Admin create; members list |
| PATCH/DELETE | `/organizations/:id/document-categories/:categoryId` | Admin |
| POST/GET | `/organizations/:id/document-tags` | Members |
| PATCH/DELETE | `/organizations/:id/document-tags/:tagId` | Members |

## Documents — create & upload loop

| Method | Path | Notes |
|--------|------|-------|
| POST | `/organizations/:id/documents` | Creates shell with status `pending_upload` |
| POST | `/organizations/:id/documents/:documentId/upload-url` | Creates `DocumentUploadSession` + R2 presigned PUT |
| POST | `/organizations/:id/documents/:documentId/versions/confirm` | Confirms upload; **server streams R2 object through SHA-256** (constant memory) and rejects client hash mismatch; optional envelope encryption |
| GET | `/organizations/:id/documents/:documentId/download-url` | Presigned GET for plaintext versions; proxy hint when encrypted |
| GET | `/organizations/:id/documents/:documentId/versions/:versionId/download-url` | Presigned GET for a version |
| GET | `/organizations/:id/documents/:documentId/content` | Streams decrypted bytes for envelope-encrypted objects |

### Integrity & encryption (Phase 1)

- Confirm always re-hashes via `streamSha256Object` — do not trust client `contentHash` alone.
- When `DOCUMENT_ENCRYPTION_ENABLED=true`, ciphertext is written to `{objectKey}.enc` with metadata on `DocumentVersion` (`encrypted`, `encryptionAlgorithm`, `keyVersion`, `wrappedDek`, `iv`, `authTag`, `encryptionMetadata`).
- Keys: `DOCUMENT_KEY_V1|V2|V3` + `DOCUMENT_ACTIVE_KEY_VERSION`.
- Malware: `MALWARE_SCANNER=mock|http|clamav` via adapter interface.

### Confirm body

```json
{
  "uploadSessionId": "uuid",
  "contentHash": "<sha256 hex>",
  "mimeType": "application/pdf",
  "sizeBytes": 1234,
  "originalFileName": "diploma.pdf",
  "activate": false
}
```

Confirm behavior:

1. Validates session is `pending` and not expired  
2. `HeadObject` on R2 — rejects missing objects (`DOC_UPLOAD_INCOMPLETE`)  
3. MIME/size checks; malware + encryption hooks (default allow / passthrough)  
4. **Same-document hash dedupe** — rejects duplicate `content_hash` (`DOC_DUPLICATE_CONTENT`)  
5. **Org-wide hash lookup** — if the same SHA-256 already exists in the org, reuses that `objectKey`  
6. Creates `document_versions` row; sets `current_version_id`; marks session `completed`  
7. Status becomes `draft` (or `active` when `activate: true`)

## Documents — metadata, list, search

| Method | Path | Notes |
|--------|------|-------|
| GET | `/organizations/:id/documents` | Filters: `q`, `status`, `categoryId`, `tag`, `expiresBefore`, `includeDeleted`, `limit`, `offset` |
| GET | `/organizations/:id/documents/:documentId` | Detail + current version summary |
| PATCH | `/organizations/:id/documents/:documentId` | Metadata / draft↔active |
| GET | `/organizations/:id/documents/:documentId/versions` | Version history |

Search uses PostgreSQL `ILIKE` / contains on title, description, and tag names. Full-text search is deferred.

## Archive, expiration, soft delete

| Method | Path | Notes |
|--------|------|-------|
| POST | `/organizations/:id/documents/:documentId/archive` | → `archived` |
| POST | `/organizations/:id/documents/:documentId/restore` | Restores to `active` / `expired` / `draft` |
| PATCH | `/organizations/:id/documents/:documentId/expiration` | Body `{ "expiresAt": "<iso>|null" }` |
| DELETE | `/organizations/:id/documents/:documentId` | Soft delete (`deletedAt`) |

## Sharing & access policies

Permissions (ascending): `view` < `download` < `edit` < `manage`.

Effective access = max of: creator, org admin / super admin, active shares, access policies.

Default is private: other org employees need a share or policy.

| Method | Path | Notes |
|--------|------|-------|
| POST/GET | `/organizations/:id/documents/:documentId/shares` | Create / list |
| DELETE | `/organizations/:id/documents/:documentId/shares/:shareId` | Revoke |
| PUT/GET | `/organizations/:id/documents/:documentId/access-policies` | Replace-all / list |

## Audit

| Method | Path | Notes |
|--------|------|-------|
| GET | `/organizations/:id/documents/:documentId/audit` | Document-scoped entries |

## Error codes

| Code | When |
|------|------|
| `DOC_NOT_FOUND` | Missing document/version |
| `DOC_FORBIDDEN` | ACL / object key prefix |
| `DOC_EXPIRED` | Download blocked for expired document |
| `DOC_ARCHIVED` | Invalid transition for archived doc |
| `DOC_DELETED` | Soft-deleted |
| `DOC_INVALID_MIME` | MIME not in allow-list |
| `DOC_TOO_LARGE` | Over max size (25 MiB) or size mismatch |
| `DOC_HASH_MISMATCH` | Reported size ≠ R2 object |
| `DOC_UPLOAD_INCOMPLETE` | Session/object missing or incomplete |
| `DOC_DUPLICATE_CONTENT` | Same SHA-256 already on this document |
| `DOC_MALWARE` | Scanner rejected content |

## Explicit non-goals (Wave 2)

- Blockchain anchoring  
- QR verification  
- AI modules  
- Browser extension integration  
- Mobile synchronization  
