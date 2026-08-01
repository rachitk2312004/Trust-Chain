import type { ExtensionSettings } from "../../types/extension.types.js";

export function assertManualInput(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error("EXT_INVALID_INPUT");
  }
  if (input.length > 8_000) throw new Error("EXT_INPUT_TOO_LONG");
  return input.trim();
}

export function parseSettingsPatch(input: unknown): Partial<ExtensionSettings> {
  if (!input || typeof input !== "object") throw new Error("EXT_INVALID_SETTINGS");
  const raw = input as Record<string, unknown>;
  const out: Partial<ExtensionSettings> = {};
  if (typeof raw.apiBaseUrl === "string") {
    try {
      const parsed = new URL(raw.apiBaseUrl);
      out.apiBaseUrl = parsed.toString().replace(/\/$/, "");
    } catch {
      throw new Error("EXT_INVALID_API_URL");
    }
  }
  if (typeof raw.autoScanEnabled === "boolean") out.autoScanEnabled = raw.autoScanEnabled;
  if (typeof raw.clipboardScanEnabled === "boolean") {
    out.clipboardScanEnabled = raw.clipboardScanEnabled;
  }
  if (typeof raw.notificationsEnabled === "boolean") {
    out.notificationsEnabled = raw.notificationsEnabled;
  }
  if (typeof raw.analyticsEnabled === "boolean") out.analyticsEnabled = raw.analyticsEnabled;
  if (typeof raw.cacheTtlMs === "number" && Number.isFinite(raw.cacheTtlMs)) {
    out.cacheTtlMs = Math.min(Math.max(raw.cacheTtlMs, 60_000), 7 * 24 * 60 * 60 * 1000);
  }
  if (typeof raw.extensionEnabled === "boolean") out.extensionEnabled = raw.extensionEnabled;
  return out;
}
