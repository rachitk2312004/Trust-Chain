import { createBraveAdapter } from "./brave/index.js";
import { createChromeAdapter } from "./chrome/index.js";
import { createEdgeAdapter } from "./edge/index.js";
import { createFirefoxAdapter } from "./firefox/index.js";
import type { BrowserAdapter } from "./types.js";

export function getBrowserAdapter(): BrowserAdapter {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Firefox\//i.test(ua)) return createFirefoxAdapter();
  if (/Edg\//i.test(ua)) return createEdgeAdapter();
  if (/Brave/i.test(ua)) return createBraveAdapter();
  return createChromeAdapter();
}

export type { BrowserAdapter };
