# Infrastructure

No Docker / Docker Compose in this repository.

Local/managed services:

- PostgreSQL (Prisma)
- Backblaze B2
- Mailtrap or Gmail SMTP
- Optional Redis (non-permanent only)
- Hardhat node when needed

CI: `.github/workflows/ci.yml` (GitHub Actions Postgres service + Prisma migrate).
