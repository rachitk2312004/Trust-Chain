# TrustChain

Multi-platform document trust cloud.

## Layout

```
apps/backend|web|mobile|extension
packages/config|database|ui|types
blockchain/
docs/
infrastructure/
```

## Stack

| Area | Choice |
|------|--------|
| Database | PostgreSQL + Prisma |
| Object storage | Cloudflare R2 |
| Email | Mailtrap or Gmail SMTP |
| Cache | Redis (optional) |
| Blockchain | Hardhat |

## Commands

```bash
npm install
npm run db:generate
npm run migrate:up
npm run db:seed
npm run ci
```

Source of truth: specs + `IMPLEMENTATION_PLAN.md`.
