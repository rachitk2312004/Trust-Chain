# Wave 1 API (API-first)

Base path: `/api/v1`

## Auth

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | No |
| POST | `/auth/login` | No |
| POST | `/auth/mfa/verify` | No (MFA challenge) |
| POST | `/auth/refresh` | No |
| POST | `/auth/logout` | Bearer |
| POST | `/auth/email/verify` | No |
| POST | `/auth/email/resend` | No |
| POST | `/auth/password/forgot` | No |
| POST | `/auth/password/reset` | No |
| GET/DELETE | `/auth/sessions` | Bearer |
| GET/DELETE | `/auth/devices` | Bearer |
| POST | `/auth/mfa/setup` · `/enable` · `/disable` | Bearer |

## Identity

| Method | Path | Auth |
|--------|------|------|
| GET | `/me` | Bearer |

## Organizations

| Method | Path | Notes |
|--------|------|-------|
| POST/GET/PATCH | `/organizations` · `/:id` | Creator becomes org_admin |
| CRUD | `/organizations/:id/branches` | Org admin |
| CRUD | `/organizations/:id/departments` | Org admin |
| GET/PATCH | `/organizations/:id/members` | Member list / admin update |
| POST/GET | `/organizations/:id/invitations` | Invite email via SMTP |
| POST | `/invitations/accept` | Bearer + matching email |
| GET/PUT | `/organizations/:id/branding` | Logo key via Cloudflare R2 |
| POST | `/organizations/:id/branding/logo-upload-url` | Presigned R2 upload |
| POST/GET | `/organizations/:id/imports` · `/:jobId` | CSV bulk import |

## Infrastructure notes

- PostgreSQL is the source of truth (Prisma schema going forward).
- Redis is optional and must not store permanent data.
- Object storage: Cloudflare R2 only.
- Email: Mailtrap or Gmail SMTP.
- No Docker Compose / MinIO in this repository workflow.
- Blockchain stores hashes/metadata/tx IDs only — never complete files.
