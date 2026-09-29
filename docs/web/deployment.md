# Web portal deployment

## Build

```bash
npm run build -w @trustchain/web
```

Output: `apps/web/dist` (static assets).

## Serve

Serve `dist` behind any static host / CDN (Nginx, Cloudflare Pages, S3+CloudFront, etc.).

### Vercel

Hard refresh 404s happen when Vercel looks for a real file at deep routes (e.g. `/organizations/.../members`). This repo includes SPA fallbacks in both places:

1. **Repo root** `vercel.json` — use when Vercel Root Directory is `.` (monorepo). Sets `outputDirectory` to `apps/web/dist` and rewrites all paths to `index.html`.
2. **`apps/web/vercel.json`** — use when Vercel Root Directory is `apps/web`.

In the Vercel project settings:

- Prefer **Root Directory** = repository root (`.`), so the root `vercel.json` applies, **or**
- Set Root Directory to `apps/web` and keep Framework Preset as **Vite**
- Do **not** set Framework Preset to **Other** (that can ignore SPA rewrites)
- After changing `vercel.json`, redeploy (a new production deployment)

### Other static hosts

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
  script-src 'self' https://checkout.razorpay.com https://cdn.razorpay.com;
  frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com;
  connect-src 'self' https://api.example.com https://*.backblazeb2.com https://api.razorpay.com https://lumberjack.razorpay.com;
```

Razorpay Checkout **requires** `script-src` / `frame-src` for `checkout.razorpay.com` and `api.razorpay.com`. A CSP with only `script-src 'self'` creates billing orders but never opens the payment modal.

Tighten `connect-src` to your API, storage, and Razorpay hosts only.

## Runtime config

Bake `VITE_API_URL` at build time. Rebuild when the API origin changes.
