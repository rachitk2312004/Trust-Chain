# Wave 4 API — Verification Engine

Base path: `/api/v1`

Auth: `Authorization: Bearer <access_token>` + document ACL (`view`; `download` if `rehashFromR2`).

**Networks for chain reads:** Hardhat and Sepolia only.

## Trust path

```
R2 object → SHA-256 → PostgreSQL → Blockchain → Revocation → Report
```

## Internal state vs external outcome

**Internal `status`:** `pending` | `processing` | `completed` | `failed`

**External `verificationResult` / `outcome`:** `valid` | `invalid` | `revoked` | `expired` | `missing` | `tampered`

Human-readable id: `VERIFY-YYYYMMDD-XXXXXXXX` (`verificationCode`).

## Proof metadata (report)

| Field | Meaning |
|-------|---------|
| `proofOfIntegrity` | SHA-256 content hash used as integrity proof |
| `proofTimestamp` | When proof/report was produced |
| `networkName` | Hardhat / Sepolia display name |
| `transactionHash` | Anchor or revoke tx hash |
| `blockNumber` | Anchor block number |

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/organizations/:id/documents/:documentId/verify` | Sync (default) or async (`202`) |
| GET | `/organizations/:id/documents/:documentId/verification-status` | Latest |
| GET | `/organizations/:id/documents/:documentId/verification-history` | History |
| GET | `/organizations/:id/verifications` | Org list |
| GET | `/organizations/:id/verifications/:verificationId` | Detail |
| POST | `/organizations/:id/verifications/process` | Drain async queue |

### Verify body

```json
{
  "mode": "sync",
  "documentVersionId": "uuid?",
  "expectedContentHash": "sha256-hex?",
  "rehashFromR2": false,
  "requireAnchor": true,
  "requireLiveChain": false,
  "idempotencyKey": "client-key?"
}
```

Optional header: `Idempotency-Key`.

## Cache invalidation

Verification cache rows for a document are deleted when:

- version confirmed  
- document updated  
- document archived / restored  
- document anchored  
- document revoked on-chain  

## Error codes

`VERIFY_NOT_FOUND`, `VERIFY_FORBIDDEN`, `VERIFY_RATE_LIMITED`, `VERIFY_IN_PROGRESS`, `CHAIN_REPLAY`, `CHAIN_SIGNATURE_INVALID`

## Explicit non-goals

- QR, AI, OCR  
- Browser extension / mobile sync  
- Public verification APIs  
