# TrustChain AI Service (Wave 9)

Advisory-only AI/OCR microservice. Never revokes certificates, executes blockchain transactions, mutates verification results, runs autonomous agents, or self-modifies prompts.

## Run tests

```bash
cd services/ai
pip install -r requirements.txt
PYTHONPATH=. pytest
```

## Run API

```bash
cd services/ai
pip install -r requirements.txt
PYTHONPATH=. uvicorn api.app:app --reload --port 8090
```

Health: `GET /health`  
Internal: `/internal/ocr`, `/internal/extract`, `/internal/classify`, `/internal/search`, `/internal/fraud`, `/internal/pipeline`, `/internal/jobs/{job_id}`
