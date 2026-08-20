export class TrustChainError extends Error {
  readonly statusCode: number | null;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string | null;

  constructor(input: {
    message: string;
    code?: string;
    statusCode?: number | null;
    details?: unknown;
    requestId?: string | null;
  }) {
    super(input.message);
    this.name = "TrustChainError";
    this.code = input.code ?? "SDK_ERROR";
    this.statusCode = input.statusCode ?? null;
    this.details = input.details;
    this.requestId = input.requestId ?? null;
  }
}

export class TrustChainAuthError extends TrustChainError {
  constructor(message = "Authentication failed", requestId?: string | null) {
    super({ message, code: "UNAUTHORIZED", statusCode: 401, requestId });
    this.name = "TrustChainAuthError";
  }
}

export class TrustChainRateLimitError extends TrustChainError {
  constructor(message = "Rate limit exceeded", requestId?: string | null) {
    super({ message, code: "RATE_LIMITED", statusCode: 429, requestId });
    this.name = "TrustChainRateLimitError";
  }
}

export class TrustChainValidationError extends TrustChainError {
  constructor(message: string, details?: unknown, requestId?: string | null) {
    super({
      message,
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details,
      requestId,
    });
    this.name = "TrustChainValidationError";
  }
}

export function isTrustChainError(error: unknown): error is TrustChainError {
  return error instanceof TrustChainError;
}
