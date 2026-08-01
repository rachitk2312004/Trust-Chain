import jsQR from "jsqr";
import { detectCandidates } from "../utils/detectors.js";

function collectPageText(): string {
  const parts: string[] = [document.body?.innerText ?? ""];
  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    parts.push((a as HTMLAnchorElement).href);
  }
  return parts.join("\n");
}

function highlightMatches(count: number): void {
  if (count === 0) return;
  const existing = document.getElementById("tc-ext-banner");
  if (existing) existing.remove();
  const banner = document.createElement("div");
  banner.id = "tc-ext-banner";
  banner.style.cssText =
    "position:fixed;z-index:2147483646;left:12px;bottom:12px;max-width:320px;padding:10px 12px;border-radius:8px;background:#0f172a;color:#f8fafc;font:12px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)";
  banner.textContent = `TrustChain found ${count} verifiable item(s). Open the extension to verify.`;
  document.documentElement.appendChild(banner);
  window.setTimeout(() => banner.remove(), 6000);
}

async function decodeImageFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, imageData.width, imageData.height);
  return result?.data ?? null;
}

function setupDragDrop(): void {
  window.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
  });
  window.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    e.preventDefault();
    void decodeImageFile(file).then((decoded) => {
      if (!decoded) return;
      const candidates = detectCandidates(decoded, "dnd");
      if (candidates[0]) {
        void chrome.runtime.sendMessage({ type: "VERIFY_CANDIDATE", candidate: candidates[0] });
      }
    });
  });
}

function autoScan(): void {
  const candidates = detectCandidates(collectPageText(), "page");
  if (candidates.length) {
    highlightMatches(candidates.length);
    void chrome.runtime.sendMessage({ type: "CANDIDATES_FOUND", candidates });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CONTENT_SCAN") {
    const candidates = detectCandidates(collectPageText(), "page");
    sendResponse({ ok: true, candidates });
    return true;
  }
  return false;
});

autoScan();
setupDragDrop();
