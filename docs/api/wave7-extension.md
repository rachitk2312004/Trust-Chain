# Wave 7 API / Client — Browser Extension

Independent Manifest V3 client. All verification goes through Wave 5 / Wave 6 public APIs. The extension never verifies locally and never holds database, R2, or chain credentials.

```
Browser → Extension → /api/public → Verification engine → Signed report
```

## Identifiers

| Kind | Format |
|------|--------|
| Session | `EXT-SESSION-XXXXXXXX` |
| Cache entry | `EXT-CACHE-XXXXXXXX` |
| Analytics event | `EXT-EVENT-XXXXXXXX` |

## Lifecycle states

`active` | `inactive` | `scanning` | `verifying` | `blocked` | `failed`

## Network / offline states

`online` | `offline` | `synchronizing`

- **offline:** serve encrypted cached signed reports only; show cache age  
- **synchronizing:** network failed; showing last cached report while retry path exhausted  
- Verification is **never** computed locally  

## Public API usage

| Capability | Endpoint |
|------------|----------|
| Code | `GET /api/public/verify/:code` |
| Hash | `GET /api/public/hash/:hash` |
| Link | `GET /api/public/link/:token` |
| QR | `GET /api/public/qr/:token` |
| Document | `GET /api/public/document/:PUB-VERIFY-…` |
| Tx | `GET /api/public/tx/:txHash` |

Base URL: `VITE_API_URL` (default `http://localhost:3000`).

## Manifest permissions

Required: `storage`, `activeTab`, `scripting`, `tabs`, `contextMenus`, `notifications`, `sidePanel`  
Optional: `clipboardRead`, `clipboardWrite`

## Module layout

- `src/background` — orchestration, menus, notifications  
- `src/content` — page scan, DnD image QR decode (no OCR)  
- `src/popup` / `sidepanel` / `options` — UI  
- `src/scanner` — detectors + QR decode  
- `src/security` — encryption, report validators, permissions, sandbox  
- `src/adapters` — chrome / firefox / edge / brave  
- `src/analytics` — local events + health metrics  

## Health metrics

- `scanSuccessRate`  
- `verificationLatency` (avg ms)  
- `cacheHitRatio`  
- `networkFailures`  

## Security notes

- CSP on extension pages; `connect-src` limited to configured API hosts  
- AES-GCM encryption for cached reports / key material in `chrome.storage.local`  
- Signed report validation is structural + expiry (server HMAC secret is **not** embedded)  
- Client rate limit mirrors Wave 5 window  

## Load (Chromium)

```bash
npm run build -w @trustchain/extension
# chrome://extensions → Load unpacked → apps/extension/dist
```

Firefox: see `apps/extension/manifests/README.md`.

## Explicit non-goals

AI, OCR, mobile sync, webhooks.
