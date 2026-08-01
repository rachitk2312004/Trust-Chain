import { scanClipboard } from "./clipboardScanner.js";
import { scanPageDom, scanText } from "./pageScanner.js";
import { decodeQrFromBlob } from "./qrScanner.js";
import { detectCandidates } from "../utils/detectors.js";
import type { ScanCandidate } from "../types/extension.types.js";

export async function runManualScan(input: string): Promise<ScanCandidate[]> {
  return scanText(input, "manual");
}

export async function runClipboardScan(enabled: boolean): Promise<ScanCandidate[]> {
  if (!enabled) return [];
  return scanClipboard();
}

export function runDomScan(doc: Document = document): ScanCandidate[] {
  return scanPageDom(doc);
}

export async function runImageScan(blob: Blob): Promise<ScanCandidate[]> {
  const decoded = await decodeQrFromBlob(blob);
  if (!decoded) return [];
  return detectCandidates(decoded, "image");
}

export { detectCandidates };
