import type { TrustChainClient } from "./client.js";
import type { Certificate, CreateCertificateInput } from "./types.js";

export class CertificatesResource {
  constructor(private readonly client: TrustChainClient) {}

  create(input: CreateCertificateInput, opts?: { idempotencyKey?: string }) {
    return this.client.request<{ certificate: Certificate }>({
      method: "POST",
      path: "/certificates",
      body: input,
      idempotencyKey: opts?.idempotencyKey,
    });
  }

  get(id: string) {
    return this.client.request<{ certificate: Certificate }>({
      method: "GET",
      path: `/certificates/${id}`,
    });
  }
}
