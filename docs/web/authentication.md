# Authentication flow

## Login

1. `POST /api/v1/auth/login`
2. If MFA required → store `mfaToken` in memory → `/mfa` → `POST /auth/mfa/verify`
3. Otherwise apply session tokens

## Token storage (Phase A hardening)

Backend does **not** currently set httpOnly auth cookies.

Client approach:

| Token | Storage | Lifetime |
|-------|---------|----------|
| Access token | In-memory (`tokenVault`) | Until tab refresh / logout |
| Refresh token | `sessionStorage` | Until tab close / logout |
| Active org id | `localStorage` prefs | Persisted |

Legacy `localStorage` session blobs that held JWTs are purged on boot/logout.

## Refresh

`apiClient` response interceptor:

1. On 401 (non-auth routes), single-flight `POST /auth/refresh`
2. Retry original request
3. On refresh failure → clear vault + emit `session-expired` / `forced-logout`

Network / 502–504 responses retry up to 2 times with backoff.

## Bootstrap

`SessionBootstrap` on app load:

1. If access token already in memory → ready
2. Else if refresh token in sessionStorage → refresh silently
3. Else anonymous
4. When authenticated → `GET /me` for roles/memberships

## Logout

`POST /auth/logout` (best effort) then clear vault + React Query cache.
