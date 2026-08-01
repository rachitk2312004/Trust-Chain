# Wave 5 API — Public Verification Layer

## URL format specification

Public host (configurable via `PUBLIC_VERIFY_BASE_URL`, default `https://verify.trustchain.com`):

| Purpose | URL |
|---------|-----|
| Signed / expiring link | `{base}/link/{token}` |
| Content hash | `{base}/hash/{sha256}` |
| Verification code | `{base}/verify/{VERIFY-…}` |
| Document public id | `{base}/document/{PUB-VERIFY-…}` |
| Transaction hash | `{base}/tx/{txHash}` |

API mirror (same path suffixes under `/api/public`):

- `POST /api/public/verify`
- `GET /api/public/verify/:verificationId`
- `GET /api/public/hash/:hash`
- `GET /api/public/tx/:transactionHash`
- `GET /api/public/document/:documentId` ← **PUB-VERIFY code**, never internal UUID
- `GET /api/public/link/:token`

## Public identifiers

| Kind | Format |
|------|--------|
| Document public id | `PUB-VERIFY-XXXXXXXX` |
| Public link code | `PUB-LINK-XXXXXXXX` |
| Org verification code (Wave 4) | `VERIFY-YYYYMMDD-XXXXXXXX` |

Internal database UUIDs are **not** returned on public routes.

## Visibility levels

`private` | `organization` | `public` | `restricted`

Only `public` and `restricted` documents are publicly verifiable.

## Signed public reports

Every public report includes:

- `reportSignature` — HMAC-SHA256  
- `reportChecksum` — SHA-256 of canonical payload  
- `issuedAt` / `expiresAt`  
- proof + chain fields from Wave 4  

## Abuse protection

- Per-IP rate limit (20 / 5 min)  
- IP reputation / strike counting  
- Temporary blocks with exponential backoff  
- Uniform `PUBLIC_VERIFY_NOT_FOUND` for probes  

## Authenticated companion (`/api/v1`)

| Method | Path |
|--------|------|
| PATCH | `/organizations/:id/documents/:documentId/public-verification` |
| POST/GET | `/organizations/:id/documents/:documentId/public-links` |
| POST | `.../public-links/:publicCode/revoke` \| `disable` |
| GET | `.../public-verification/events` \| `analytics` |

## Env

```
PUBLIC_VERIFY_BASE_URL=https://verify.trustchain.com
PUBLIC_VERIFY_SIGNING_SECRET=...
```

## Explicit non-goals

QR, AI, OCR, extension, mobile sync, webhooks.
