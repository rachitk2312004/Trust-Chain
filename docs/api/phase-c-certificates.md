# Phase C — Certificates API

Base: `/api/v1/certificates`  
Auth: Bearer access token required.  
Org scope: `organizationId` on body/query.

## Models

- `CertificateTemplate` — org-scoped layout presets (JSON layout, not a visual editor)
- `Certificate` — issued certificate with integrity hash, verification URL, optional document/QR link
- `CertificateEvent` — append-only history (`issued`, `revoked`, `verified`, …)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/certificates/templates` | Create template |
| GET | `/certificates/templates?organizationId=` | List templates |
| GET | `/certificates/templates/:templateId?organizationId=` | Get template |
| PATCH | `/certificates/templates/:templateId?organizationId=` | Update template |
| POST | `/certificates` | Issue certificate |
| GET | `/certificates?organizationId=` | List certificates |
| GET | `/certificates/:certificateId?organizationId=` | Get certificate |
| GET | `/certificates/:certificateId/history?organizationId=` | Event history |
| POST | `/certificates/:certificateId/verify` | Verify integrity/status |
| POST | `/certificates/:certificateId/revoke` | Revoke certificate |
| GET | `/certificates/:certificateId/pdf?organizationId=` | Download PDF |
| GET | `/certificates/:certificateId/png?organizationId=` | Download PNG |
| GET | `/certificates/:certificateId/svg?organizationId=` | Download SVG |
| POST | `/certificates/bulk/preview` | Validate CSV/JSON import |
| POST | `/certificates/bulk` | Start bulk issuance job |
| GET | `/certificates/bulk/:jobId?organizationId=` | Bulk job progress |
| POST | `/certificates/bulk/:jobId/cancel` | Cancel bulk job |
| GET | `/certificates/analytics?organizationId=` | Full analytics snapshot |
| GET | `/certificates/analytics/templates?organizationId=` | Template utilization |
| GET | `/certificates/analytics/issuance?organizationId=` | Issuance / revocation / expiration |
| GET | `/certificates/analytics/downloads?organizationId=` | Download / render metrics |
| GET | `/certificates/analytics/verifications?organizationId=` | Verification metrics |
| POST | `/certificates/admin/reprocess` | Re-verify / re-render certificates |
| POST | `/certificates/admin/cleanup` | Retention cleanup |

## Rendering (Step 2)

Supports portrait/landscape A4 (or Letter), organization branding colors/logo, optional background/signature image keys in template `layout`, QR embedding (linked QR asset or generated from `verificationUrl`), and placeholders:

- `{{certificate_id}}`, `{{recipient_name}}`, `{{organization_name}}`
- `{{issue_date}}`, `{{expiration_date}}`, `{{verification_url}}`

Unknown placeholders resolve to empty and are reported via `X-Certificate-Warnings`.

Missing optional assets (logo/background/signature) degrade gracefully with warnings.

## Issue body (POST `/`)

```json
{
  "organizationId": "uuid",
  "title": "Completion Certificate",
  "recipientName": "Ada Lovelace",
  "recipientEmail": "ada@example.com",
  "recipientUserId": "uuid?",
  "templateId": "uuid?",
  "documentId": "uuid?",
  "expiresAt": "ISO-8601?",
  "metadata": {},
  "createQr": false
}
```

When `createQr: true` and `documentId` is set, creates a document QR via the existing QR service and stores `qrPublicCode`.

## Verification result

Returns `{ certificate, verification }` where `verification` includes:

- `valid`
- `checks.integrity | notRevoked | notExpired | documentOk`
- `reasons[]`

## Notifications

Emits `certificate_issued` / `certificate_revoked` via existing `emitDomainNotification`.

## Web portal (Step 3)

Routes (org-scoped via active organization):

| Path | Page |
|------|------|
| `/certificates` | List, search/filter, issue |
| `/certificates/templates` | Template list + layout editor |
| `/certificates/bulk` | Bulk CSV/JSON upload, preview, progress |
| `/certificates/analytics` | Metrics, template/bulk/download panels, ops |
| `/certificates/:certificateId` | Detail, preview, downloads |
| `/certificates/:certificateId/history` | Event timeline |
| `/certificates/:certificateId/verify` | Verification panel |

Client API: `certificateApi` → `/api/v1/certificates` with `organizationId` query/body.
Capabilities: `certificates.view`, `certificates.issue` (staff), `certificates.manage` (admin: templates/revoke).

## Bulk issuance (Step 4)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/certificates/bulk/preview` | Parse + validate CSV/JSON without issuing |
| POST | `/certificates/bulk` | Start async bulk job (`202`) |
| GET | `/certificates/bulk/:jobId?organizationId=` | Poll progress |
| POST | `/certificates/bulk/:jobId/cancel` | Request cancel (+ optional rollback) |

Import fields: `recipient_name`, `recipient_email`, `certificate_identifier`, `issue_date`, `expiration_date`, `template_identifier`, `title`, `metadata` (JSON object).

Validation covers duplicates, emails, dates, missing/inactive templates, and malformed metadata. Cancelled jobs can revoke certificates issued in that batch (`rollbackOnCancel`).

## Analytics & ops (Step 5)

Org-admin scoped. Durable metrics aggregate `Certificate`, `CertificateEvent`, and `CertificateBulkJob`. Downloads/renders also emit `downloaded` / `rendered` events and update in-process latency counters.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/certificates/analytics` | Full snapshot |
| GET | `/certificates/analytics/templates` | Template utilization |
| GET | `/certificates/analytics/issuance` | Issuance / revocation / expiration / bulk |
| GET | `/certificates/analytics/downloads` | Download volume + render latency |
| GET | `/certificates/analytics/verifications` | Verification volume + latency |
| POST | `/certificates/admin/reprocess` | Re-verify/re-render certificates |
| POST | `/certificates/admin/cleanup` | Event / bulk-job / diagnostic retention purge |

Retention defaults: events 365d, terminal bulk jobs 90d, download/render diagnostics 30d (env-overridable).

## Out of scope

Advanced signing, drag-and-drop template editors, DOCX export.
