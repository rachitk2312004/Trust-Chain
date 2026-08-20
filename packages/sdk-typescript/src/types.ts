export type TrustChainClientOptions = {
  /** API key (`tc_live_…` / `tc_test_…`) or service-account secret. */
  apiKey: string;
  /** Origin including protocol/host, e.g. https://api.example.com */
  baseUrl?: string;
  /** Public API prefix, default /api/public/v1 */
  publicBasePath?: string;
  /** Max retry attempts for transient failures (default 3). */
  maxRetries?: number;
  /** Initial retry delay in ms (default 200). */
  retryDelayMs?: number;
  /** Optional fetch implementation (defaults to global fetch). */
  fetch?: typeof fetch;
  /** Default timeout ms (default 30000). */
  timeoutMs?: number;
};

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  idempotencyKey?: string;
  requestId?: string;
  headers?: Record<string, string>;
  /** Skip automatic retries for this call. */
  skipRetry?: boolean;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type Document = {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDocumentInput = {
  title: string;
  description?: string;
  expiresAt?: string | null;
};

export type Certificate = Record<string, unknown> & {
  id?: string;
  publicId?: string;
  organizationId?: string;
};

export type CreateCertificateInput = {
  title: string;
  recipientName: string;
  description?: string | null;
  recipientEmail?: string | null;
  documentId?: string | null;
  templateId?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type Signature = Record<string, unknown> & {
  id?: string;
  publicId?: string;
  organizationId?: string;
};

export type CreateSignatureInput = {
  documentId?: string | null;
  certificateId?: string | null;
  algorithm?: string;
  contentHash?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type HealthResponse = {
  ok: boolean;
  version: string;
  organizationId: string;
  authType: "api_key" | "service_account";
  requestId?: string;
};

export type UsageResponse = {
  metrics: Record<string, unknown>;
  requests: Array<Record<string, unknown>>;
  total: number;
  limit: number;
  offset: number;
};

export type WebhookVerificationResult = {
  valid: boolean;
  timestamp: string | null;
  signature: string | null;
  reason?: string;
};
