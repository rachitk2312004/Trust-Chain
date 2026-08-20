# Web portal deployment

## Build

```bash
npm run build -w @trustchain/web
```

Output: `apps/web/dist` (static assets).

## Serve

Serve `dist` behind any static host / CDN (Nginx, Cloudflare Pages, S3+CloudFront, etc.).

Recommended Nginx snippets:

1. SPA fallback to `index.html`
2. Cache hashed assets aggressively
3. Do **not** cache `index.html`

## CSP (production)

Prefer HTTP headers over the development meta tag in `index.html`:

```
Content-Security-Policy:
  default-src 'self';
  base-uri 'self';
  frame-ancestors 'none';
  object-src 'none';
  img-src 'self' data: blob: https:;
  style-src 'self' 'unsafe-inline';
  script-src 'self';
  connect-src 'self' https://api.example.com https://*.r2.cloudflarestorage.com;
```

Tighten `connect-src` to your API and storage hosts only.

## Runtime config

Bake `VITE_API_URL` at build time. Rebuild when the API origin changes.
