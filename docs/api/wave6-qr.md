# Wave 6 API — QR Generation & Discovery

QR codes are **transport/discovery only**. They resolve through the Wave 5 public verification layer into the Wave 4 engine. Payloads never contain file bytes, R2 keys, secrets, or raw database UUIDs.

## Format versions

| Version | Payload | Purpose |
|---------|---------|---------|
| **V1** | URL string | Camera-app friendly (`{base}/qr/{token}`) |
| **V2** | Signed JSON | Mobile clients (HMAC + integrity metadata) |
| **V3** | Offline verification JSON | Hash + chain proof metadata + signature |

## Integrity metadata

Every stored QR includes:

- `payloadChecksum` — SHA-256 of canonical payload JSON  
- `payloadHash` — SHA-256 of the wire string encoded in the QR  
- `signatureVersion` — currently `"1"`  
- `algorithm` — currently `HMAC-SHA256`

## Public scan

| Method | Path |
|--------|------|
| GET | `/api/public/qr/:token` |

Flow: abuse checks → QR status gate → `publicVerifyByLinkToken` (Wave 5) → QR analytics.

Canonical discovery URL (also used as V1 wire payload):

`{PUBLIC_VERIFY_BASE_URL}/qr/{token}`

## Authenticated org routes (`/api/v1/organizations/:id`)

### Templates (+ print optimization)

| Method | Path |
|--------|------|
| POST/GET | `/qr/templates` |
| GET/PATCH | `/qr/templates/:templateCode` |

Print fields on templates: `pageSize` (A4/Letter), `dpi`, `marginMm`, `bleedMm`, `qrPerPage`.

### Document QR lifecycle

| Method | Path |
|--------|------|
| POST/GET | `/documents/:documentId/qr` |
| GET | `/qr` \| `/qr/:publicCode` |
| GET | `/qr/:publicCode/download?format=png\|svg\|base64` |
| POST | `/qr/:publicCode/revoke` \| `disable` \| `rotate` |
| GET | `/documents/:documentId/qr/events` \| `analytics` |
| GET | `/qr/events` \| `/qr/analytics` |

### Batch operations

| Method | Path |
|--------|------|
| POST | `/qr/batch` |
| POST | `/qr/batch/rotate` |

Body examples:

```json
{ "documentIds": ["…"], "formatVersion": "V1", "templatePublicCode": "QR-TPL-…" }
```

```json
{ "publicCodes": ["QR-…"], "formatVersion": "V2" }
```

### Print PDF export

| Method | Path |
|--------|------|
| POST | `/qr/print` |

```json
{ "publicCodes": ["QR-…"], "templatePublicCode": "QR-TPL-…" }
```

Returns `application/pdf` using template print settings.

## Public identifiers

| Kind | Format |
|------|--------|
| QR code | `QR-XXXXXXXX` |
| QR template | `QR-TPL-XXXXXXXX` |

## Statuses

`active` | `revoked` | `expired` | `rotated` | `disabled`

## Explicit non-goals

AI modules, OCR, browser extensions, mobile synchronization, webhooks.
