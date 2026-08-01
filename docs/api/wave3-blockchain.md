# Wave 3 API — Blockchain Integration

Base path: `/api/v1`

Auth: `Authorization: Bearer <access_token>`

**Networks:** Hardhat (`31337`) and Sepolia (`11155111`) only.

**Contract:** single `DocumentRegistry` (org registration + anchor + revoke + events).

**On-chain payload only:**

- SHA-256 content hash  
- Organization ID  
- Document ID  
- Version number  
- Timestamp  
- Revocation status  

Never file bytes. PostgreSQL (Prisma) is the operational source of truth; Cloudflare R2 stores files.

## Trust path

```
R2 file bytes → SHA-256 → PostgreSQL metadata → DocumentRegistry anchor
```

## Anchor statuses

| Status | Meaning |
|--------|---------|
| `pending` | Submit in flight / not yet confirmed |
| `anchored` | Confirmed on-chain |
| `revoked` | Revoked on-chain |
| `failed` | Submit/confirm failed (retryable) |

Block metadata on transactions and anchors: `blockNumber`, `blockHash`, `transactionIndex`, `confirmationCount`.

## Networks

| Method | Path | Notes |
|--------|------|-------|
| GET | `/blockchain/networks` | Active Hardhat + Sepolia rows |
| GET | `/blockchain/networks/current` | Configured `CHAIN_NETWORK` |
| POST | `/blockchain/jobs/process` | Super-admin retry drain |

## Organization chain

| Method | Path | Notes |
|--------|------|-------|
| GET | `/organizations/:id/blockchain` | Registration status |
| POST | `/organizations/:id/blockchain/register` | Register org on-chain (admin) |
| GET | `/organizations/:id/blockchain/transactions` | Tx history |
| GET | `/organizations/:id/blockchain/transactions/:txId` | Tx detail |
| GET | `/organizations/:id/blockchain/events` | Indexed events for org txs |
| POST | `/organizations/:id/blockchain/retries/:jobId/run` | Re-queue job |

## Document chain

| Method | Path | Notes |
|--------|------|-------|
| POST | `/organizations/:id/documents/:documentId/anchor` | Anchor current (or given) **active** version |
| GET | `/organizations/:id/documents/:documentId/anchors` | List anchors |
| POST | `/organizations/:id/documents/:documentId/revoke-on-chain` | On-chain revoke |
| GET | `/organizations/:id/documents/:documentId/chain-status` | Combined status |

Soft-delete / archive (Wave 2) is separate from on-chain revoke.

## Env

```
CHAIN_ENABLED=true
CHAIN_NETWORK=hardhat|sepolia
CHAIN_RPC_URL=...
CHAIN_PRIVATE_KEY=...
CHAIN_DOCUMENT_REGISTRY_ADDRESS=0x...
CHAIN_CONFIRMATIONS=1
```

Deploy locally:

```bash
npm run compile -w @trustchain/blockchain
npm run deploy -w @trustchain/blockchain -- --network localhost
```

## Error codes

| Code | When |
|------|------|
| `CHAIN_NOT_CONFIGURED` | Missing env / disabled |
| `CHAIN_NETWORK_MISMATCH` | Unsupported network or RPC chainId mismatch |
| `CHAIN_ORG_NOT_REGISTERED` | Anchor before register |
| `CHAIN_DOC_NOT_ANCHORABLE` | Missing version / not active / not anchored |
| `CHAIN_ALREADY_ANCHORED` | Duplicate anchor |
| `CHAIN_ALREADY_REVOKED` | Already revoked |
| `CHAIN_TX_FAILED` | Submit/confirm failure |
| `CHAIN_REPLAY` | Expired intent signature |
| `CHAIN_SIGNATURE_INVALID` | Bad EIP-712 signature |

## Explicit non-goals (Wave 3)

- QR, AI, OCR  
- Browser extension / mobile sync  
- Public verification APIs  
- Networks other than Hardhat and Sepolia  
- Splitting into multiple contracts (deferred)  
