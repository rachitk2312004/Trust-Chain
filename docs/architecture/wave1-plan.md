# Regenerated Wave 1 Implementation Plan

See **IMPLEMENTATION_PLAN.md §16** for the authoritative regenerated Wave 1 plan.

Summary of decisions applied to Wave 1:

| Area | Decision |
|------|----------|
| Database | PostgreSQL |
| ORM | Prisma (`packages/database`) |
| Object storage | Cloudflare R2 |
| Cache | Redis optional (unused in Wave 1 app logic) |
| Email | Mailtrap or Gmail SMTP |
| Blockchain | Hardhat (no document bytes on-chain) |
| Containers | No Docker / Docker Compose / MinIO |
| Delivery | API-first |

Target layout:

```
trustchain/
├── apps/backend|web|mobile|extension
├── packages/config|database|ui|types
├── blockchain/
├── docs/
└── infrastructure/
```
