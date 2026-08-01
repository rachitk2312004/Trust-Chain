import { ExtensionLifecycleStates, ExtensionNetworkStates } from "@trustchain/config";
import { getBrowserAdapter } from "../adapters/index.js";
import { getHealthMetrics, recordScanAttempt } from "../analytics/health.js";
import { recordExtEvent, listExtEvents } from "../analytics/events.js";
import { isWarningOutcome, trustBadge } from "../security/signatures/reportValidation.js";
import { parseSettingsPatch, assertManualInput } from "../security/validators/schemas.js";
import { ensureClipboardPermission } from "../security/permissions/clipboard.js";
import { formatCacheAge } from "../utils/time.js";
import { clearCache, getCachedById, listCachedReports } from "../services/cacheManager.js";
import { verifyCandidate } from "../services/publicVerify.js";
import { runManualScan } from "../scanner/index.js";
import type {
  ExtensionMessage,
  ExtensionSettings,
  ExtensionStateSnapshot,
  ScanCandidate,
  VerifyResult,
} from "../types/extension.types.js";
import { generateExtId } from "../utils/ids.js";

const SETTINGS_KEY = "tc_ext_settings";
const SESSION_KEY = "tc_ext_session";
const LAST_RESULT_KEY = "tc_ext_last_result";

const defaultSettings = (): ExtensionSettings => ({
  apiBaseUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000",
  autoScanEnabled: true,
  clipboardScanEnabled: false,
  notificationsEnabled: true,
  analyticsEnabled: true,
  cacheTtlMs: 24 * 60 * 60 * 1000,
  extensionEnabled: true,
});

let lifecycle: ExtensionStateSnapshot["lifecycle"] = ExtensionLifecycleStates.active;
let network: ExtensionStateSnapshot["network"] = ExtensionNetworkStates.online;
let lastError: string | null = null;
let sessionId = generateExtId("session");

const adapter = getBrowserAdapter();

async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return {
    ...defaultSettings(),
    ...(stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined),
  };
}

async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

async function loadSession(): Promise<void> {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  if (typeof stored[SESSION_KEY] === "string") {
    sessionId = stored[SESSION_KEY];
  } else {
    sessionId = generateExtId("session");
    await chrome.storage.local.set({ [SESSION_KEY]: sessionId });
  }
}

async function setBadge(): Promise<void> {
  const text =
    lifecycle === ExtensionLifecycleStates.verifying
      ? "…"
      : lifecycle === ExtensionLifecycleStates.scanning
        ? "S"
        : lifecycle === ExtensionLifecycleStates.blocked
          ? "!"
          : lifecycle === ExtensionLifecycleStates.failed
            ? "×"
            : lifecycle === ExtensionLifecycleStates.inactive
              ? "off"
              : "";
  try {
    await adapter.action.setBadgeText({ text });
  } catch {
    // ignore
  }
}

async function getSnapshot(): Promise<ExtensionStateSnapshot> {
  const settings = await loadSettings();
  const health = await getHealthMetrics();
  const lastStored = await chrome.storage.local.get(LAST_RESULT_KEY);
  const lastResult = (lastStored[LAST_RESULT_KEY] as VerifyResult | null) ?? null;
  if (!settings.extensionEnabled) lifecycle = ExtensionLifecycleStates.inactive;
  return {
    sessionId,
    lifecycle,
    network,
    settings,
    lastResult,
    lastError,
    health,
  };
}

async function notify(result: VerifyResult): Promise<void> {
  const settings = await loadSettings();
  if (!settings.notificationsEnabled) return;
  if (!isWarningOutcome(result.report.verificationResult)) return;
  try {
    await adapter.notifications.create(`tc-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: `TrustChain: ${trustBadge(result.report.verificationResult)}`,
      message: result.fromCache
        ? `Cached report (${formatCacheAge(result.cachedAt)})`
        : "Verification completed with a warning.",
    });
  } catch {
    // ignore
  }
}

async function runVerify(candidate: ScanCandidate): Promise<VerifyResult> {
  const settings = await loadSettings();
  if (!settings.extensionEnabled) throw new Error("EXT_INACTIVE");
  lifecycle = ExtensionLifecycleStates.verifying;
  await setBadge();
  try {
    const result = await verifyCandidate(candidate, settings);
    network = result.networkState;
    lastError = null;
    lifecycle = ExtensionLifecycleStates.active;
    await chrome.storage.local.set({ [LAST_RESULT_KEY]: result });
    await notify(result);
    await setBadge();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "EXT_FAILED";
    lastError = message;
    lifecycle =
      message === "EXT_RATE_LIMITED"
        ? ExtensionLifecycleStates.blocked
        : ExtensionLifecycleStates.failed;
    await setBadge();
    throw error;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void loadSession();
  void adapter.contextMenus.removeAll().then(() => {
    void adapter.contextMenus.create({
      id: "tc-verify-selection",
      title: "Verify with TrustChain",
      contexts: ["selection", "link", "image"],
    });
  });
});

void loadSession();

chrome.contextMenus.onClicked.addListener((info) => {
  void (async () => {
    try {
      if (info.menuItemId === "tc-verify-selection") {
        const text = info.selectionText || info.linkUrl || info.srcUrl || "";
        const candidates = await runManualScan(text);
        if (candidates[0]) await runVerify(candidates[0]);
      }
    } catch {
      // surfaced via state
    }
  })();
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      switch (message.type) {
        case "GET_STATE": {
          sendResponse({ ok: true, state: await getSnapshot() });
          break;
        }
        case "SET_SETTINGS": {
          const settings = await loadSettings();
          const patch = parseSettingsPatch(message.settings);
          if (patch.clipboardScanEnabled) {
            const ok = await ensureClipboardPermission();
            if (!ok) patch.clipboardScanEnabled = false;
          }
          const next = { ...settings, ...patch };
          await saveSettings(next);
          lifecycle = next.extensionEnabled
            ? ExtensionLifecycleStates.active
            : ExtensionLifecycleStates.inactive;
          await setBadge();
          sendResponse({ ok: true, state: await getSnapshot() });
          break;
        }
        case "VERIFY_MANUAL": {
          const input = assertManualInput(message.input);
          lifecycle = ExtensionLifecycleStates.scanning;
          await setBadge();
          const candidates = await runManualScan(input);
          await recordScanAttempt(candidates.length > 0);
          if (!candidates[0]) throw new Error("EXT_NO_CANDIDATE");
          const result = await runVerify(candidates[0]);
          sendResponse({ ok: true, result, state: await getSnapshot() });
          break;
        }
        case "VERIFY_CANDIDATE": {
          const result = await runVerify(message.candidate);
          sendResponse({ ok: true, result, state: await getSnapshot() });
          break;
        }
        case "SCAN_PAGE": {
          lifecycle = ExtensionLifecycleStates.scanning;
          await setBadge();
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) throw new Error("EXT_NO_TAB");
          const injected = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const texts: string[] = [document.body?.innerText ?? ""];
              for (const a of Array.from(document.querySelectorAll("a[href]"))) {
                texts.push((a as HTMLAnchorElement).href);
              }
              return texts.join("\n");
            },
          });
          const pageText = injected[0]?.result ?? "";
          const found = await runManualScan(String(pageText));
          await recordScanAttempt(found.length > 0);
          await recordExtEvent({
            kind: "page_scan",
            success: found.length > 0,
            enabled: (await loadSettings()).analyticsEnabled,
            meta: { count: found.length },
          });
          lifecycle = ExtensionLifecycleStates.active;
          await setBadge();
          if (found[0]) {
            const result = await runVerify(found[0]);
            sendResponse({ ok: true, candidates: found, result, state: await getSnapshot() });
          } else {
            sendResponse({ ok: true, candidates: found, state: await getSnapshot() });
          }
          break;
        }
        case "GET_HISTORY": {
          sendResponse({
            ok: true,
            cache: await listCachedReports(),
            events: await listExtEvents(),
          });
          break;
        }
        case "CLEAR_CACHE": {
          await clearCache();
          sendResponse({ ok: true });
          break;
        }
        case "GET_HEALTH": {
          sendResponse({ ok: true, health: await getHealthMetrics() });
          break;
        }
        case "EXPORT_REPORT": {
          const cached = message.cacheId ? await getCachedById(message.cacheId) : null;
          const lastStored = await chrome.storage.local.get(LAST_RESULT_KEY);
          const last = (lastStored[LAST_RESULT_KEY] as VerifyResult | null) ?? null;
          const report = cached?.report ?? last?.report ?? null;
          sendResponse({ ok: Boolean(report), report });
          break;
        }
        case "CANDIDATES_FOUND": {
          await recordScanAttempt(message.candidates.length > 0);
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ ok: false, error: "EXT_UNKNOWN_MESSAGE" });
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "EXT_FAILED",
        state: await getSnapshot(),
      });
    }
  })();
  return true;
});

console.info("TrustChain extension service worker ready", { adapter: adapter.id, sessionId });
