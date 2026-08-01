import { detectCandidates } from "../utils/detectors";
import { sanitizeText } from "../security/sandbox/sanitize";
import type { ScanCandidate } from "../types/mobile.types";

export function scanText(text: string, source: ScanCandidate["source"]): ScanCandidate[] {
  return detectCandidates(sanitizeText(text), source);
}

/** Gallery/camera image QR decode expects RGBA ImageData-like input from the UI layer. */
export function candidatesFromQrPayload(payload: string): ScanCandidate[] {
  return detectCandidates(payload, "camera");
}
