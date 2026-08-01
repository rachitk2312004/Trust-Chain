# Database

PostgreSQL via **Prisma** (`packages/database`) is the source of truth.

```bash
npm run db:generate
npm run migrate:up          # prisma migrate deploy
npm run db:seed
```

Legacy `node-pg-migrate` SQL files are archived at `docs/archive/legacy-node-pg-migrations/`.

Schema reference notes: `database/schemas/wave1.md`.
