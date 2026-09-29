# Integrations

- `mailer.ts` — SMTP for non-auth mail (certificates, org invites). Auth OTP does not use this.
- `firebaseAdmin.ts` — Firebase Auth: create users, send 6-digit verification emails via Identity Toolkit (`sendOobCode`), mark email verified
- `objectStorage.ts` — Cloudflare R2 for uploaded files

Redis is optional and must not be used for permanent data.
PostgreSQL (Prisma going forward) is the source of truth for application state.
