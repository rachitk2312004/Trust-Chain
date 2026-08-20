# @trustchain/sdk

Official TrustChain TypeScript / JavaScript SDK for `/api/public/v1`.

```ts
import { TrustChain, verifyWebhook } from "@trustchain/sdk";

const sdk = new TrustChain({
  apiKey: "tc_live_...",
  baseUrl: "https://api.example.com",
});

await sdk.health();
await sdk.documents.create({ title: "Contract" });

verifyWebhook({
  secret: "whsec_...",
  body: rawBody,
  signatureHeader: req.headers["x-trustchain-signature"] as string,
});
```
