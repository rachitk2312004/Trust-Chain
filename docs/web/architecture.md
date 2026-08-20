# TrustChain Web Portal — Architecture

The web portal (`apps/web`) is a Vite + React SPA that consumes the Express API under `/api/v1`.

## Layers

1. **Routes / pages** — `src/app/router.tsx`, `src/pages/*`
2. **Feature modules** — `src/features/{auth,organizations,documents,verification,qr}`
3. **Shared UI** — `@trustchain/ui` (Button, Table, Toast, Modal, forms)
4. **Services** — Axios clients in `src/services/*` (one client per domain)
5. **Session** — `tokenVault` (tokens) + Zustand prefs (`activeOrganizationId`, cached user)

## Data fetching

React Query owns server state. Defaults:

- `staleTime`: 60s (longer for categories/tags, QR previews/analytics)
- `retry`: 1 for queries; 0 for mutations
- Optimistic updates for archive/restore

## Auth bootstrap

`SessionBootstrap` restores an access token via refresh (sessionStorage) before protected routes render, loads `/me` roles, and listens for session-expiration events.

## Role-aware UI

Capabilities are derived from `/me` role bindings (`src/lib/permissions.ts`) and gated with `<Can />` / `usePermissions()`. API 403s remain the source of truth.
