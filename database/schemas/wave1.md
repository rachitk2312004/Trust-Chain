# Wave 1 schema reference

Authoritative modeling going forward: **Prisma** in `packages/database`.

Legacy SQL migrations under `database/migrations/` document the first Wave 1 shape and are not the ongoing source of truth.

## Identity

- `users`
- `roles` (seeded: super_admin, org_admin, employee, public_user)
- `role_bindings`
- `sessions`
- `devices`
- `mfa_factors`
- `mfa_login_challenges`
- `email_tokens`

## Organizations

- `organizations` (optional parent hierarchy)
- `branches`
- `departments`
- `memberships`
- `invitations`
- `organization_branding`
- `bulk_import_jobs`

## Required indexes (Wave 1)

| Index target |
|--------------|
| users(email) |
| organizations(slug) |
| sessions(user_id) / sessions(userId) |
| devices(user_id) / devices(userId) |
| memberships(organization_id) |
| invitations(email) |
| email_tokens(token_hash) |
| role_bindings(user_id) |

Object binaries (logos, import CSVs, documents) are stored in **Cloudflare R2**. PostgreSQL stores object keys and metadata only. Never store complete files on the blockchain.
