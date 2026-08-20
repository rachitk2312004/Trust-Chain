# Environment variables

Configured in `apps/web` via Vite (`import.meta.env`).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | no | `http://localhost:3000` | Backend origin (no trailing slash). API calls use `${VITE_API_URL}/api/v1`. |

## Example `.env`

```bash
VITE_API_URL=http://localhost:3000
```

## Notes

- Tokens are **not** configured via env; they come from auth APIs.
- Object storage uploads use short-lived URLs returned by the API.
- For production, set `VITE_API_URL` to the public API origin and enforce CSP at the edge (see deployment guide).
