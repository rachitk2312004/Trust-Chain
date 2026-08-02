# Phase 2 Step 7 — Dead-code audit (AI consolidation)

Classification of `stub` / `RedisStub` / `setImmediate` / `InProcessExecutor` / `TODO` / `FIXME`
under `services/ai/` and `apps/backend/src/modules/ai/`.

| Occurrence | Classification | Notes |
|------------|----------------|-------|
| OCR engine name `stub` (`services/ai/ocr/engine.py`, Wave 9 `engine` enum) | **intentional** | CI/local OCR when heavy binaries absent; public API still accepts `stub` |
| Adapter fallback slot `stub` (`adapters/routing.py`, `capability_adapters.py`, `fallback.py`) | **development-only** | Skipped when production mode; allowed for CI/local |
| `AI_ALLOW_STUB_FALLBACK` / `allowStubAdapterFallback` | **development-only** | Production force-disables |
| `StubOcrEngine` / `test_ocr_stub.py` | **intentional** | Engine implementation for CI |
| Model registry provider `stub` (`models/registry`, `fallback`, `benchmarks`) | **compatibility layer** | Provider catalog still lists stub for local routing |
| `R2ReaderStub` bucket default `trustchain-stub` | **development-only** | Local placeholder reader |
| Express `OcrEngines.stub` / auto→stub mapping in `ai.service.ts` | **compatibility layer** | Maps Wave 9 engine id into FastAPI adapters |
| Comments mentioning stub removal / dual-stack | **intentional** | Documentation of Step 6 removal |
| Tests asserting stub processors removed / RedisStub absent | **intentional** | Hardening assertions |
| `RedisStub` / `redis_stub.py` | **dead code (removed)** | Deleted in Step 6; tests assert absence |
| Express `setImmediate` dual-stack | **dead code (removed)** | Absent from `modules/ai`; tests assert |
| `InProcessExecutor` in `workflows/executor.py` | **development-only** | Deprecated; unwired from `/internal` routers; retained for isolated experiments |
| `celery_task_stub` | **development-only** | Optional Celery placeholder |
| `TODO` / `FIXME` in AI module paths | **none found** | No outstanding TODO/FIXME markers |

## Verdict

No actionable dead code remains on the production execution path.
Remaining `stub` tokens are either Wave 9 OCR engine compatibility, adapter CI fallback, or deprecated unwired helpers.
