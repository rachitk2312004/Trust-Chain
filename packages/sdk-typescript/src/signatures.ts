import type { TrustChainClient } from "./client.js";
import type { CreateSignatureInput, Signature } from "./types.js";

export class SignaturesResource {
  constructor(private readonly client: TrustChainClient) {}

  create(input: CreateSignatureInput, opts?: { idempotencyKey?: string }) {
    return this.client.request<{
      signature: Signature;
      generatedPrivateKeyPem?: string;
    }>({
      method: "POST",
      path: "/signatures",
      body: input,
      idempotencyKey: opts?.idempotencyKey,
    });
  }

  get(id: string) {
    return this.client.request<{ signature: Signature }>({
      method: "GET",
      path: `/signatures/${id}`,
    });
  }
}
