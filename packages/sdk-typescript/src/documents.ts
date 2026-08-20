import type { TrustChainClient } from "./client.js";
import type { CreateDocumentInput, Document } from "./types.js";

export class DocumentsResource {
  constructor(private readonly client: TrustChainClient) {}

  create(input: CreateDocumentInput, opts?: { idempotencyKey?: string }) {
    return this.client.request<{ document: Document }>({
      method: "POST",
      path: "/documents",
      body: input,
      idempotencyKey: opts?.idempotencyKey,
    });
  }

  get(id: string) {
    return this.client.request<{ document: Document }>({
      method: "GET",
      path: `/documents/${id}`,
    });
  }
}
