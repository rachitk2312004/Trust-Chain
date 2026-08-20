# Known limitations (Phase A web portal)

- **No httpOnly cookie auth** — refresh tokens remain JS-readable in `sessionStorage`; XSS can still steal them. Migrate when backend cookie sessions land.
- **Invitation revoke** — no dedicated revoke endpoint; UI documents disabling membership instead.
- **Organization delete** — soft-disable via `PATCH status=disabled` only.
- **QR delete** — soft-disable / revoke; no hard delete.
- **Logo preview after reload** — API stores `logoObjectKey` only; no public logo download URL, so preview requires a freshly uploaded blob URL.
- **Client RBAC** — capability checks hide actions but are not a security boundary; API enforces authorization.
- **Access policy subject pickers** — role keys / user identifiers are free-text (API contract), not full directory search.
- **E2E** — Vitest + MSW integration/a11y coverage; no Cypress/Playwright suite in this repo.
- **Phase B/C features** — signatures, blockchain UI, and encryption changes remain out of scope. Certificates portal (Phase C Step 3) is available under `/certificates`.
- **Certificate preview** — PNG preview depends on backend rendering; missing optional assets surface as download/preview warnings.
