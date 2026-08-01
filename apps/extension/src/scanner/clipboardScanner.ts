import { hasClipboardPermission } from "../security/permissions/clipboard.js";
import { sanitizeText } from "../security/sandbox/sanitize.js";
import { detectCandidates } from "../utils/detectors.js";
import type { ScanCandidate } from "../types/extension.types.js";

export async function scanClipboard(): Promise<ScanCandidate[]> {
  const allowed = await hasClipboardPermission();
  if (!allowed) return [];
  try {
    const text = await navigator.clipboard.readText();
    return detectCandidates(sanitizeText(text), "clipboard");
  } catch {
    return [];
  }
}
