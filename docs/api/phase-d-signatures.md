# Phase D — Digital Signatures API

Base: `/api/v1/signatures`  
Auth: Bearer access token required.  
Org scope: `organizationId` on body/query.

## Models

- `Signature` — signed record with algorithm, public key, payload/integrity hashes, lifecycle status
- `SignatureEvent` — append-only history (`created`, `verified`, `revoked`, `expired`, `reprocessed`, `downloaded`)
- `SignatureArtifact` — canonical payload, detached signature value, public key PEM, optional detached payload

## Algorithms

| Algorithm | Status |
|-----------|--------|
| `RSA-SHA256` | Supported |
| `ECDSA-P256-SHA256` | Supported |
| `Ed25519` | Reserved (returns `ALGORITHM_NOT_IMPLEMENTED`) |

## Endpoints

### Step 1 — foundation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/signatures` | Create signature (generic) |
| GET | `/signatures?organizationId=` | List signatures |
| GET | `/signatures/:signatureId?organizationId=` | Get signature + artifacts |
| POST | `/signatures/:signatureId/verify` | Cryptographic + integrity verify |
| POST | `/signatures/:signatureId/revoke` | Revoke (policy-aware) |
| GET | `/signatures/:signatureId/history?organizationId=` | Event history |

### Step 2 — signing workflows

| Method | Path | Description |
|--------|------|-------------|
| POST | `/signatures/document` | Document signing workflow |
| POST | `/signatures/certificate` | Certificate signing workflow |
| POST | `/signatures/detached` | Detached payload signing |
| POST | `/signatures/verify` | Verify stored **or** detached materials |

## Workflow steps

1. Retrieve target (document / certificate / detached payload)
2. Create canonical payload
3. Validate organization policy (algorithm, expiration, workflow kind)
4. Generate signature (RSA / ECDSA)
5. Store artifacts
6. Emit notifications
7. Publish signature events

## Document signing (POST `/document`)

```json
{
  "organizationId": "uuid",
  "documentId": "uuid",
  "algorithm": "RSA-SHA256",
  "privateKeyPem": "optional",
  "expiresAt": "2027-08-03T12:00:00.000Z",
  "metadata": {}
}
```

Requires document status `draft` or `active` and a current version content hash.

## Certificate signing (POST `/certificate`)

```json
{
  "organizationId": "uuid",
  "certificateId": "uuid",
  "algorithm": "ECDSA-P256-SHA256"
}
```

Requires certificate status `issued` (not revoked/expired). Binds `contentHash` to certificate integrity hash.

## Detached signing (POST `/detached`)

```json
{
  "organizationId": "uuid",
  "payload": { "statement": "Approved" },
  "algorithm": "RSA-SHA256"
}
```

`payload` may be a string, JSON object, or `{ "content": "...", "contentType": "text/plain" }`.  
Stores a `detached_payload` artifact and returns detached artifact handles.

## Verification workflow (POST `/verify`)

Stored:

```json
{ "organizationId": "uuid", "signatureId": "uuid" }
```

Detached (stateless):

```json
{
  "organizationId": "uuid",
  "detached": {
    "signerId": "uuid",
    "algorithm": "RSA-SHA256",
    "publicKeyPem": "...",
    "signatureValue": "...",
    "signedAt": "2026-08-03T12:00:00.000Z",
    "metadata": { "purpose": "detached-test", "workflow": "detached" },
    "payload": { "statement": "Approved" }
  }
}
```

## Policies

Default org policy (`SignaturePolicyDefaults`):

- Allowed algorithms: RSA-SHA256, ECDSA-P256-SHA256
- Default expiration: 365 days when `expiresAt` omitted (`null` disables)
- Max expiration: 5 years
- Detached / document / certificate workflows enabled
- Revoke by signer or org admin

Error codes include: `ALGORITHM_POLICY_DENIED`, `WORKFLOW_POLICY_DENIED`, `DOCUMENT_NOT_SIGNABLE`, `CERTIFICATE_NOT_SIGNABLE`, `EXPIRATION_REQUIRED`, `EXPIRATION_TOO_FAR`, `SIGNATURE_EXPIRED`, `SIGNATURE_REVOKED`, `INVALID_DETACHED_PAYLOAD`, `INVALID_PAYLOAD`.

## Create body (POST `/`)

```json
{
  "organizationId": "uuid",
  "documentId": "uuid | null",
  "certificateId": "uuid | null",
  "algorithm": "RSA-SHA256",
  "privateKeyPem": "optional PKCS8 PEM",
  "expiresAt": "2027-08-03T12:00:00.000Z",
  "metadata": { "purpose": "approval" },
  "contentHash": "optional override; else document current version hash"
}
```

When `privateKeyPem` is omitted, the server generates a keypair and returns `generatedPrivateKeyPem` **once** (not stored).

## Canonical payload

Signed JSON fields (stable key order):

- `organizationId`, `signerId`, `documentId`, `certificateId`
- `timestamp`, `algorithm`, `metadata`, `contentHash`

## Integrations

- **Documents** — document workflow + content hash binding
- **Certificates** — certificate workflow + integrity hash binding
- **Verification** — stored verify + detached verify + document hash check
- **Notifications** — `signature_created`, `signature_verified`, `signature_revoked`, workflow/approval events

## Multi-party approvals (Step 4)

### Models

- `SignatureWorkflow` — sequential / parallel / threshold approval request
- `SignatureApproval` — per-reviewer assignment + decision
- `SignatureApprovalEvent` — audit log (`created`, `approved`, `rejected`, `cancelled`, `expired`, `progressed`, `completed`)

### API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/signatures/workflows` | Create workflow + assign reviewers |
| GET | `/signatures/workflows?organizationId=` | List workflows |
| GET | `/signatures/workflows/:workflowId?organizationId=` | Detail + approvals + events |
| POST | `/signatures/workflows/:workflowId/approve` | Approve current assignment |
| POST | `/signatures/workflows/:workflowId/reject` | Reject (terminal) |
| POST | `/signatures/workflows/:workflowId/cancel` | Cancel (creator or admin) |

### Types & states

- Types: `sequential`, `parallel`, `threshold`
- States: `pending`, `approved`, `rejected`, `cancelled`, `expired`

### Portal

| Path | Page |
|------|------|
| `/signatures/workflows` | Workflow list |
| `/signatures/workflows/:workflowId` | Timeline, approve/reject/cancel |

## Out of scope

- Org-persisted signing policy storage (in-memory defaults)
- Ed25519 signing
- Blockchain anchoring of signatures

## Analytics, retention & administration (Step 5)

Org admin only (`assertOrgAdmin`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/signatures/analytics?organizationId=` | Full analytics snapshot |
| GET | `/signatures/analytics/workflows?organizationId=` | Workflow completion / rejection / latency |
| GET | `/signatures/analytics/algorithms?organizationId=` | Algorithm distribution |
| GET | `/signatures/analytics/verifications?organizationId=` | Verification success + latency |
| GET | `/signatures/analytics/detached?organizationId=` | Detached + download/artifact stats |
| POST | `/signatures/admin/reprocess` | Re-verify signatures; repair expired status |
| POST | `/signatures/admin/cleanup` | Retention cleanup (events, workflows, artifacts, diagnostics) |

### Metrics tracked

- Created / verified / revoked / expired signatures
- Algorithm distribution
- Workflow completion & rejection rates
- Approval & verification latency (process + durable)
- Download / artifact statistics
- Detached signature statistics

### Retention

Cleans: signature events, approval events, terminal workflows, artifacts on revoked/expired signatures, short-lived diagnostic events (`verified`, `reprocessed`, `downloaded`).

### Portal

| Path | Page |
|------|------|
| `/signatures/analytics` | Metrics panels + ops (reprocess / cleanup) |

## Web portal (Step 3)

Routes:

| Path | Page |
|------|------|
| `/signatures` | Signature list, create, filters |
| `/signatures/analytics` | Analytics & administration |
| `/signatures/history` | Event timeline (select signature) |
| `/signatures/detached` | Detached sign/verify studio |
| `/signatures/policies` | Policy viewer |
| `/signatures/workflows` | Approval workflows |
| `/signatures/workflows/:workflowId` | Workflow detail |
| `/signatures/:signatureId` | Detail, verify, revoke, artifact downloads |
