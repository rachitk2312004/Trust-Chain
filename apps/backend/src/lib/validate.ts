import { type ZodTypeAny } from "zod";
import { AppError } from "./errors.js";

export function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): T["_output"] {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Request body validation failed",
      result.error.flatten(),
    );
  }
  return result.data;
}

export function parseQuery<T extends ZodTypeAny>(schema: T, query: unknown): T["_output"] {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Query validation failed", result.error.flatten());
  }
  return result.data;
}

export function parseParams<T extends ZodTypeAny>(schema: T, params: unknown): T["_output"] {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Path parameter validation failed",
      result.error.flatten(),
    );
  }
  return result.data;
}
