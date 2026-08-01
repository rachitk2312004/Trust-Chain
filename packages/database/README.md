# @trustchain/database

PostgreSQL access via **Prisma**. Schema and migrations here are the database source of truth.

## Commands

```bash
npm run db:validate -w @trustchain/database
npm run db:generate -w @trustchain/database
npm run db:migrate -w @trustchain/database
npm run db:migrate:deploy -w @trustchain/database
npm run db:seed -w @trustchain/database
```

Requires `DATABASE_URL`.

## Policy

- Preserve existing PostgreSQL table/column names (`@map` / `@@map`).
- Cloudflare R2 stores files; DB stores metadata and object keys.
- Redis must not store permanent data.
- Never store complete files on the blockchain.
