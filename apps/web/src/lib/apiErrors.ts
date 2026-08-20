import axios, { type AxiosError } from "axios";
import type { ApiErrorBody } from "../types/api";

export type ParsedApiError = {
  status?: number;
  code?: string;
  message: string;
};

export function parseApiError(error: unknown, fallback = "Request failed"): ParsedApiError {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const ax = error as AxiosError<ApiErrorBody>;
    return {
      status: ax.response?.status,
      code: ax.response?.data?.error?.code,
      message: ax.response?.data?.error?.message ?? ax.message ?? fallback,
    };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: fallback };
}

export function getApiErrorMessage(error: unknown, fallback = "Request failed"): string {
  const parsed = parseApiError(error, fallback);
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const details = error.response?.data?.error?.details as
      | { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
      | undefined;
    const fieldMsgs = details?.fieldErrors
      ? Object.entries(details.fieldErrors).flatMap(([field, msgs]) =>
          (msgs ?? []).map((m) => `${field}: ${m}`),
        )
      : [];
    if (fieldMsgs.length) {
      return `${parsed.message} (${fieldMsgs.join("; ")})`;
    }
  }
  return parsed.message;
}

export function isInvalidCredentials(error: unknown): boolean {
  return parseApiError(error).code === "INVALID_CREDENTIALS";
}

export function isRateLimited(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.status === 429 || parsed.code === "AUTH_RATE_LIMITED" || parsed.code === "RATE_LIMITED";
}

export function isAuthFailure(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.status === 401 ||
    parsed.code === "UNAUTHORIZED" ||
    parsed.code === "INVALID_REFRESH_TOKEN" ||
    parsed.code === "INVALID_CREDENTIALS"
  );
}
