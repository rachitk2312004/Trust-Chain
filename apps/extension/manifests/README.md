# Browser-specific manifests

| File | Target |
|------|--------|
| `../manifest.json` | Chromium (Chrome, Edge, Brave, Opera) — primary CRXJS build |
| `firefox.json` | Firefox MV3 compatibility overlay (background.scripts, gecko id, no sidePanel) |

Load Chromium build from `apps/extension/dist` after `npm run build -w @trustchain/extension`.

Adapters live in `src/adapters/{chrome,firefox,edge,brave}` and select at runtime via UA.
