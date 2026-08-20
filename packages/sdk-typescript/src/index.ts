import { TrustChainClient } from "./client.js";
import { DocumentsResource } from "./documents.js";
import { CertificatesResource } from "./certificates.js";
import { SignaturesResource } from "./signatures.js";
import { WebhooksResource } from "./webhooks.js";
import type { TrustChainClientOptions, UsageResponse } from "./types.js";

export class TrustChain {
  readonly client: TrustChainClient;
  readonly documents: DocumentsResource;
  readonly certificates: CertificatesResource;
  readonly signatures: SignaturesResource;
  readonly webhooks: WebhooksResource;

  constructor(options: TrustChainClientOptions) {
    this.client = new TrustChainClient(options);
    this.documents = new DocumentsResource(this.client);
    this.certificates = new CertificatesResource(this.client);
    this.signatures = new SignaturesResource(this.client);
    this.webhooks = new WebhooksResource();
  }

  health() {
    return this.client.health();
  }

  usage(query?: { days?: number; limit?: number; offset?: number }) {
    return this.client.request<UsageResponse>({
      method: "GET",
      path: "/usage",
      query: {
        days: query?.days,
        limit: query?.limit,
        offset: query?.offset,
      },
    });
  }
}

export { TrustChainClient, paginateOffset } from "./client.js";
export * from "./errors.js";
export * from "./types.js";
export { DocumentsResource } from "./documents.js";
export { CertificatesResource } from "./certificates.js";
export { SignaturesResource } from "./signatures.js";
export {
  WebhooksResource,
  verifyWebhook,
  signWebhookPayload,
  parseWebhookSignatureHeader,
} from "./webhooks.js";

/** Default export for JavaScript consumers. */
export default TrustChain;
