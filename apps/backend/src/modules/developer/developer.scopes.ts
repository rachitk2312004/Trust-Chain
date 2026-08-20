import { ApiKeyScopes, PublicApiScopeRequirements } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export type ScopeSet = Set<string>;

export function parseScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function toScopeSet(scopes: string[]): ScopeSet {
  return new Set(scopes);
}

export function hasScope(scopes: ScopeSet | string[], required: string): boolean {
  const set = Array.isArray(scopes) ? toScopeSet(scopes) : scopes;
  return set.has(required);
}

export function hasAnyScope(scopes: ScopeSet | string[], required: readonly string[]): boolean {
  const set = Array.isArray(scopes) ? toScopeSet(scopes) : scopes;
  return required.some((s) => set.has(s));
}

export function hasAllScopes(scopes: ScopeSet | string[], required: readonly string[]): boolean {
  const set = Array.isArray(scopes) ? toScopeSet(scopes) : scopes;
  return required.every((s) => set.has(s));
}

export function assertHasScope(scopes: ScopeSet | string[], required: string): void {
  if (!hasScope(scopes, required)) {
    throw new AppError(403, "INSUFFICIENT_SCOPE", `Missing required scope: ${required}`);
  }
}

export function assertHasAnyScope(scopes: ScopeSet | string[], required: readonly string[]): void {
  if (!hasAnyScope(scopes, required)) {
    throw new AppError(
      403,
      "INSUFFICIENT_SCOPE",
      `Missing required scope (any of): ${required.join(", ")}`,
    );
  }
}

export function scopesForCapability(
  capability: keyof typeof PublicApiScopeRequirements,
): readonly string[] {
  return PublicApiScopeRequirements[capability];
}

export function assertCapability(
  scopes: ScopeSet | string[],
  capability: keyof typeof PublicApiScopeRequirements,
): void {
  assertHasAnyScope(scopes, scopesForCapability(capability));
}

/** Write operations also require read is not mandatory; write alone is enough for mutations. */
export function requiredScopeForMethod(method: string): string {
  const upper = method.toUpperCase();
  if (upper === "GET" || upper === "HEAD") return ApiKeyScopes.read;
  return ApiKeyScopes.write;
}

export function isWriteMethod(method: string): boolean {
  const upper = method.toUpperCase();
  return upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE";
}
