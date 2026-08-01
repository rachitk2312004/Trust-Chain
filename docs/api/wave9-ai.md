# Wave 9 — AI & OCR Platform

Advisory AI/OCR layer. **Never** a source of truth.

```
Document → R2 → OCR → Extraction → Classification → AI analysis
                → Embeddings / Fraud (advisory)
                → Verification (Wave 4/5 — unchanged authority)
                → Audit (AiAuditEvent + existing logs)
```

**Sources of truth:** PostgreSQL metadata, Cloudflare R2 bytes, blockchain anchors, Wave 4/5 verification reports, audit logs.

## Topology

```
Clients → Express `/api/v1/ai/*` (auth, ACL, rate limit)
        → services/ai FastAPI (internal; stub engines in CI)
        → PostgreSQL (+ pgvector extension ready)
        → R2 via short-lived URLs issued by Express
```

Redis/Celery are optional. CI and local default use an in-process executor.

## Identifiers

| Kind | Format |
|------|--------|
| OCR job | `OCR-JOB-XXXXXXXX` |
| AI job | `AI-JOB-XXXXXXXX` |
| Embedding job | `EMBEDDING-JOB-XXXXXXXX` |
| Lineage | `LINEAGE-XXXXXXXX` |

## Job states

`pending` | `processing` | `completed` | `failed` | `cancelled`

## Human review states

`pending_review` | `approved` | `rejected` | `escalated`

AI never auto-finalizes decisions. Default is `pending_review`.

## Confidence & cost (every result)

- `confidence`
- `confidenceInterval` `{ low, high }`
- `modelVersion`
- `evaluationVersion`
- `tokenUsage` / `computeUsage` / `storageUsage` / `estimatedCost`

## Lineage

```
Document → OCR → Extraction → Classification → Fraud analysis
```

Tracked via `AiLineage.stepsJson` and `LINEAGE-*` public codes.

## APIs (Express gateway)

Auth: Bearer JWT + org membership + document ACL.

| Method | Path |
|--------|------|
| POST | `/api/v1/ai/ocr` |
| POST | `/api/v1/ai/classify` |
| POST | `/api/v1/ai/extract` |
| POST | `/api/v1/ai/search` |
| POST | `/api/v1/ai/fraud` |
| GET | `/api/v1/ai/jobs/:id?organizationId=` |

Org-scoped aliases under `/api/v1/organizations/:id/ai/...` plus:

- `POST .../ai/jobs/:jobId/review`
- `GET .../ai/analytics`

### Example create OCR

```json
{
  "organizationId": "uuid",
  "documentId": "uuid",
  "engine": "stub"
}
```

`engine`: `auto` | `tesseract` | `easyocr` | `paddleocr` | `stub`  
CI uses `stub` when heavy OCR binaries are absent.

## Model management

`services/ai/models/{registry,routing,versions,benchmarks,fallback}` plus Prisma `AiModelRegistryEntry`.

Providers: `openai` | `gemini` | `local` | `stub`.

## Explainability

`services/ai/explainability/{evidence,attribution,reasoning,summaries}` — attached as `explanation` / `explanationJson`.

## Policies

`services/ai/policies/{privacy,retention,access,compliance}` — checked before sensitive processing.

## Hard restrictions

AI must never:

- revoke documents
- modify blockchain records
- change Wave 4/5 verification results
- rewrite audit logs
- run autonomous agents
- self-modify prompts
- execute automated blockchain transactions

Enforced in Express (`assertSafeAiOperation`) and FastAPI (`security/guard.py`).

## Env (optional)

| Variable | Purpose |
|----------|---------|
| `AI_SERVICE_URL` | Internal FastAPI base URL |
| `AI_SERVICE_TOKEN` | Service auth token |
| `OPENAI_API_KEY` | Optional LLM/embeddings |
| `REDIS_URL` / `CELERY_BROKER_URL` | Optional async workers |

## Run AI service

```bash
cd services/ai
pip install -r requirements.txt
PYTHONPATH=. uvicorn api.app:app --port 8090
PYTHONPATH=. pytest
```

## Explicit non-goals

- Autonomous agents
- Self-modifying prompts
- Automated revocation
- Automated blockchain transactions
- Replacing Wave 4/5 as trust authority
