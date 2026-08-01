# Continuous Integration

GitHub Actions workflow:

- Path: `.github/workflows/ci.yml`
- Triggers: push to `main`/`master`, and pull requests
- Runtime: Node.js 20 LTS

Pipeline steps:

1. `npm ci`
2. `npm run lint`
3. `npm run format:check`
4. Build `@trustchain/config`
5. Workspace typecheck
6. Build backend, web, extension
7. `hardhat compile` for blockchain

Local equivalent:

```bash
npm ci
npm run lint
npm run format:check
npm run build -w @trustchain/config
npm run typecheck
npm run build -w @trustchain/backend
npm run build -w @trustchain/web
npm run build -w @trustchain/extension
npm run compile -w @trustchain/blockchain
```
