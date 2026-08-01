import { detectCandidates } from "../utils/detectors.js";
import type { ScanCandidate } from "../types/extension.types.js";

export function scanText(text: string, source: ScanCandidate["source"]): ScanCandidate[] {
  return detectCandidates(text, source);
}

export function scanPageDom(doc: Document): ScanCandidate[] {
  const texts: string[] = [];
  texts.push(doc.body?.innerText ?? "");
  for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
    const href = (a as HTMLAnchorElement).href;
    if (href) texts.push(href);
  }
  return detectCandidates(texts.join("\n"), "page");
}
