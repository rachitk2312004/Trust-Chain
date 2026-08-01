# Wave 8 — Mobile Platform

Independent Expo SDK 56 client (Android + iOS). Verification always goes through Waves 5–6 public APIs. Authenticated org/document browsing uses TrustChain JWT (Wave 1/2).

```
Mobile → Sync + offline cache → /api/public (Wave 5/6) → Verification engine → Blockchain (server-side)
```

## Identifiers

| Kind | Format |
|------|--------|
| Session | `MOBILE-SESSION-XXXXXXXX` |
| Cache | `MOBILE-CACHE-XXXXXXXX` |
| Event | `MOBILE-EVENT-XXXXXXXX` |
| Device | `MOBILE-DEVICE-XXXXXXXX` |

## Application states

`online` | `offline` | `synchronizing` | `verifying` | `blocked` | `failed`

## Sync priorities

`critical` → `high` → `normal` → `low` → `background`

## Modules (additions beyond base plan)

- `src/wallet` — lightweight identity wallet (public identities + verification artifacts only)
- `src/devices` — registration, attestation, trust, lifecycle
- `src/recovery` — sessions, cache, keys, migrations
- `src/flags` — local / remote stub / experiments
- `src/analytics` — events + health (`syncLatency`, `verificationLatency`, `cacheHitRatio`, `queueDepth`, `networkFailures`, `batteryImpact`)

## Public APIs

- `GET /api/public/verify/:code`
- `GET /api/public/hash/:hash`
- `GET /api/public/link/:token`
- `GET /api/public/qr/:token`

## Authenticated APIs

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/register`
- `GET /api/v1/organizations`
- `GET /api/v1/organizations/:id/documents`

## Screens

Splash, login, register, dashboard, organizations, documents, document viewer, verify, scanner, notifications, settings.

## Firebase

Firebase Auth is initialized as an optional client bridge when `EXPO_PUBLIC_FIREBASE_API_KEY` is set. **API authorization remains TrustChain JWT.**

## Storage

Allowed: encrypted reports (AES-GCM over MMKV facade), settings, sync metadata, analytics.  
Forbidden: chain keys, DB/R2 credentials, server secrets.

Cache storage uses an MMKV-compatible facade over AsyncStorage for Expo-managed builds.

## Run

```bash
npm run start -w @trustchain/mobile
```

## Explicit non-goals

AI, OCR, webhooks, full Module 18 digital wallet.
