import {
  TrustChainAuthError,
  TrustChainError,
  TrustChainRateLimitError,
  TrustChainValidationError,
} from "./errors.js";
import type { RequestOptions, TrustChainClientOptions } from "./types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function joinUrl(baseUrl: string, publicBasePath: string, path: string): string {
  const origin = baseUrl.replace(/\/$/, "");
  const prefix = publicBasePath.startsWith("/") ? publicBasePath : `/${publicBasePath}`;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${prefix}${suffix}`;
}

function withQuery(
  url: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export class TrustChainClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly publicBasePath: string;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TrustChainClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new TrustChainValidationError("apiKey is required");
    }
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? "http://localhost:4000").replace(/\/$/, "");
    this.publicBasePath = options.publicBasePath ?? "/api/public/v1";
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 200;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetch ?? fetch.bind(globalThis);
  }

  async request<T = unknown>(options: RequestOptions): Promise<T> {
    const method = options.method ?? (options.body !== undefined ? "POST" : "GET");
    const requestId = options.requestId ?? newId();
    const url = withQuery(
      joinUrl(this.baseUrl, this.publicBasePath, options.path),
      options.query,
    );

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "X-Request-Id": requestId,
      ...(options.headers ?? {}),
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    } else if (method !== "GET") {
      headers["Idempotency-Key"] = newId();
    }

    let attempt = 0;
    const maxAttempts = options.skipRetry ? 1 : this.maxRetries + 1;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method,
          headers,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        const responseRequestId = response.headers.get("x-request-id") ?? requestId;
        const text = await response.text();
        let payload: unknown = null;
        if (text) {
          try {
            payload = JSON.parse(text) as unknown;
          } catch {
            payload = text;
          }
        }

        if (response.ok) {
          return payload as T;
        }

        const errPayload =
          payload && typeof payload === "object"
            ? (payload as { error?: { code?: string; message?: string; details?: unknown } })
            : null;
        const code = errPayload?.error?.code ?? `HTTP_${response.status}`;
        const message =
          errPayload?.error?.message ?? `Request failed with status ${response.status}`;

        if (response.status === 401) {
          throw new TrustChainAuthError(message, responseRequestId);
        }
        if (response.status === 429) {
          if (attempt < maxAttempts) {
            await sleep(this.retryDelayMs * 2 ** (attempt - 1));
            continue;
          }
          throw new TrustChainRateLimitError(message, responseRequestId);
        }
        if (response.status === 400) {
          throw new TrustChainValidationError(
            message,
            errPayload?.error?.details,
            responseRequestId,
          );
        }
        if (isRetryableStatus(response.status) && attempt < maxAttempts) {
          await sleep(this.retryDelayMs * 2 ** (attempt - 1));
          continue;
        }

        throw new TrustChainError({
          message,
          code,
          statusCode: response.status,
          details: errPayload?.error?.details ?? payload,
          requestId: responseRequestId,
        });
      } catch (error) {
        lastError = error;
        if (error instanceof TrustChainError) throw error;
        if (attempt < maxAttempts) {
          await sleep(this.retryDelayMs * 2 ** (attempt - 1));
          continue;
        }
        throw new TrustChainError({
          message: error instanceof Error ? error.message : String(error),
          code: "NETWORK_ERROR",
          requestId,
        });
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new TrustChainError({ message: "Request failed", code: "REQUEST_FAILED" });
  }

  async health() {
    return this.request<{
      ok: boolean;
      version: string;
      organizationId: string;
      authType: "api_key" | "service_account";
      requestId?: string;
    }>({ method: "GET", path: "/health", skipRetry: true });
  }
}

/** Async generator over offset/limit pages. */
export async function* paginateOffset<T>(input: {
  pageSize?: number;
  fetchPage: (offset: number, limit: number) => Promise<{
    items: T[];
    total: number;
    limit: number;
    offset: number;
  }>;
}): AsyncGenerator<T, void, unknown> {
  const pageSize = input.pageSize ?? 20;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total) {
    const page = await input.fetchPage(offset, pageSize);
    total = page.total;
    for (const item of page.items) {
      yield item;
    }
    if (page.items.length === 0) break;
    offset += page.limit;
  }
}
