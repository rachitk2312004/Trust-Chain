# AI Models & Result Contract

Advisory model catalog and required inference result fields after Phase 2 consolidation.

## Catalog endpoint

**Public (Express):** `GET /api/v1/ai/models`  
**Internal (FastAPI):** `GET /internal/execution/models`

Example shape:

```json
{
  "models": [
    {
      "modelId": "AI-MODEL-OCR",
      "modelVersion": "MODEL-VERSION-OCR",
      "capability": "ocr",
      "provider": "local",
      "healthStatus": "healthy",
      "fallback": ["primary", "secondary"],
      "advisoryOnly": true
    }
  ],
  "advisoryOnly": true
}
```

In non-production, `fallback` may include `"stub"`. Production omits the stub slot.

## Capabilities

| Capability | Queue | Typical providers |
|------------|-------|-------------------|
| ocr | `ocr` | tesseract / easyocr / paddleocr / stub (CI engine) |
| extraction | `extraction` | openai / gemini / local |
| classification | `classification` | openai / gemini / local |
| embedding | `embedding` | local / openai |
| fraud | `fraud` | local heuristics / LLM assist |
| evaluation | `evaluation` | metrics scorers |
| explainability | (adapter only) | structured evidence/attribution |

## Required result fields

Every adapter result **must** include:

| Field | Meaning |
|-------|---------|
| `advisoryOnly` | Must be `true` |
| `modelId` | e.g. `AI-MODEL-OCR00001` |
| `modelVersion` | e.g. `MODEL-VERSION-OCR00001` |
| `executionTimeMs` | Wall time for adapter invoke |
| `lineageId` | `LINEAGE-*` public code |
| `confidence` | Numeric score in `[0, 1]` |

Missing / non-advisory results fail adapter validation (`AdapterValidationError`).

## Registry locations

| Layer | Path |
|-------|------|
| FastAPI in-memory registry | `services/ai/models/registry/` |
| Routing / fallback / versions / benchmarks | `services/ai/models/{routing,fallback,versions,benchmarks}/` |
| Express seed entries | `seedDefaultModels()` in `ai.service.ts` |
| Postgres | `AiModel` / `AiModelVersion` (Phase 2 ledger; schemas frozen for this step) |

## Providers

`openai` | `gemini` | `local` | `stub`

`stub` provider/engine remains for **CI and local** compatibility. Production routing must not silently depend on stub adapter fallback.

## Explainability

Attached by Express from gateway/adapter fields (`explanation` / `explanationJson`). Built from evidence, attribution, reasoning, and summary modules under `services/ai/explainability/` — never fabricated dual-stack prose on Express.

## Related docs

- [`gateway.md`](./gateway.md)
- [`execution.md`](./execution.md)
- [`../runbooks/metrics.md`](../runbooks/metrics.md)
