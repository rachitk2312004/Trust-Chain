# TrustChain Python SDK

Install (workspace):

```bash
pip install -e packages/sdk-python
```

Usage:

```python
from trustchain import TrustChain

sdk = TrustChain("tc_live_...", base_url="https://api.example.com")
print(sdk.health())
doc = sdk.documents.create({"title": "Contract"})
```

Webhook verification:

```python
from trustchain import verify_webhook

result = verify_webhook(
    secret="whsec_...",
    body=raw_body,
    signature_header=headers["X-TrustChain-Signature"],
)
```
