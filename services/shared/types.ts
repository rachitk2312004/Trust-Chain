/** Shared operational intelligence types (Wave 10). */

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type EnvironmentName = "development" | "staging" | "production";

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function generateCode(prefix: string): string {
  const hex = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${prefix}${hex}`;
}
