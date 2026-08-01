# Continuous Integration

Workflow: `.github/workflows/ci.yml`

- Node.js 20
- GitHub Actions Postgres 16 service
- `prisma generate` + `prisma migrate deploy` + seed
- Lint, format, typecheck, unit tests, app builds

No local Docker Compose.
