# Phase B — Notifications API

Base: `/api/v1/notifications`  
Auth: Bearer access token required.

## Event types (closed set)

`invitation_created`, `invitation_accepted`, `member_added`, `document_uploaded`, `document_verified`, `document_archived`, `document_restored`, `share_created`, `qr_created`, `qr_revoked`, `verification_completed`

## Domain emitters (Step 2)

| Source | Event | Trigger |
|--------|-------|---------|
| Organizations | `invitation_created` | `inviteToOrganization` |
| Organizations | `invitation_accepted` | `acceptInvitation` |
| Organizations | `member_added` | `acceptInvitation` |
| Documents | `document_uploaded` | `confirmDocumentVersion` |
| Documents | `document_archived` | `archiveDocument` |
| Documents | `document_restored` | `restoreDocument` |
| Documents | `share_created` | `createDocumentShare` |
| Verification | `verification_completed` | sync/async/cache verification completion |
| QR | `qr_created` | `createDocumentQr` |
| QR | `qr_revoked` | `revokeQr` |

All emitters call `emitDomainNotification` → `publishNotification` (idempotent inbox + outbox transaction).

## Delivery pipeline (Step 3)

Outbox statuses (string column, no schema migration):

`pending` → `processing` → `sent` → `delivered`

Failures: `failed` → `retry` (exponential backoff) → `dead_letter` (max attempts or permanent errors).

Channels: `in_app` (persisted at publish) and `email` (SMTP via existing mailer).

Digest modes: `immediate` | `daily` | `weekly` (user preference via reserved `_email_digest:<mode>` preference row, or `NOTIFICATION_DEFAULT_DIGEST_MODE`).

Worker: enable with `NOTIFICATION_WORKER_ENABLED=true`. Scheduler polls outbox, runs digest batches, and reclaims stale `processing` rows.

Metrics (in-process): created, sent, delivered, failed, retries, dead letters, digest volume, average delivery time, queue depth, active connections.

## Real-time delivery (Step 4)

Transport: **Server-Sent Events** (`GET /api/v1/notifications/stream`).

Auth: `Authorization: Bearer <access>` **or** `?access_token=` (EventSource cannot set headers).

SSE event names: `connected`, `heartbeat`, `notification_created`, `notification_read`, `notification_deleted`, `unread_count_updated`, `notification_delivered`.

## Analytics & ops (Step 5)

Ops gate: `requireOpsAdmin` (super_admin or any org_admin).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications/admin/overview` | Observability + analytics + retention preview |
| GET | `/notifications/admin/analytics` | Queue/delivery/failure/retry/channel/digest stats |
| GET | `/notifications/admin/observability` | Process metrics + durable analytics + SSE connections |
| GET | `/notifications/admin/queue` | Queue + retry analysis |
| GET | `/notifications/admin/delivery` | Delivery + channels + digests |
| GET | `/notifications/admin/failures` | Failure analysis + dead-letter list |
| GET | `/notifications/admin/outbox?status=` | Inspect outbox by status |
| GET | `/notifications/admin/outbox/:id` | Inspect outbox payload/status |
| GET | `/notifications/admin/notifications/:id` | Inspect notification payload |
| GET | `/notifications/admin/retention` | Retention eligibility preview |
| POST | `/notifications/admin/retention/purge` | Purge expired soft-deleted inbox + terminal outbox |
| POST | `/notifications/admin/dead-letters/retry` | Requeue dead letters (`ids` optional) |

Retention env: `NOTIFICATION_RETENTION_DAYS`, `NOTIFICATION_OUTBOX_RETENTION_DAYS`, `NOTIFICATION_RETENTION_ENABLED` (scheduler auto-purge).

Portal: `/notifications/ops` (analytics / failures / delivery / queue / retention tabs).

## Endpoints (user)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications/stream` | SSE real-time feed |
| GET | `/notifications` | Inbox list |
| GET | `/notifications/unread-count` | `{ unreadCount }` |
| GET | `/notifications/history` | Full history |
| GET | `/notifications/preferences` | Prefs + digest mode |
| PUT | `/notifications/preferences` | Update prefs |
| POST | `/notifications/read-all` | Mark all read |
| GET | `/notifications/:id` | Single notification |
| POST | `/notifications/:id/read` | Mark one read |
| DELETE | `/notifications/:id` | Soft-delete |

## Error codes

| Code | HTTP | When |
|------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid session |
| `FORBIDDEN` | 403 | Ops admin / reserved |
| `NOTIFICATION_NOT_FOUND` | 404 | Unknown notification |
| `OUTBOX_NOT_FOUND` | 404 | Unknown outbox id |
| `INVALID_PREFERENCES` | 400 | Bad preference payload |
| `VALIDATION_ERROR` | 400 | Query/body schema failure |
