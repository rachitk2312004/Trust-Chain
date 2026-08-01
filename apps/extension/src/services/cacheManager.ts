import { encryptJson, decryptJson } from "../security/encryption/crypto.js";
import type { CachedReportEntry, PublicReportView } from "../types/extension.types.js";
import { generateExtId } from "../utils/ids.js";

const CACHE_INDEX_KEY = "tc_ext_cache_index";
const CACHE_PREFIX = "tc_ext_cache:";

type CacheIndexItem = {
  cacheId: string;
  lookupKey: string;
  cachedAt: string;
  expiresAt: string | null;
};

export async function getCachedReport(lookupKey: string): Promise<CachedReportEntry | null> {
  const index = await readIndex();
  const item = index.find((i) => i.lookupKey === lookupKey);
  if (!item) return null;
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()) {
    await removeCache(item.cacheId);
    return null;
  }
  const stored = await chrome.storage.local.get(CACHE_PREFIX + item.cacheId);
  const enc = stored[CACHE_PREFIX + item.cacheId];
  if (typeof enc !== "string") return null;
  const report = await decryptJson<PublicReportView>(enc);
  return {
    cacheId: item.cacheId,
    lookupKey: item.lookupKey,
    report,
    cachedAt: item.cachedAt,
    expiresAt: item.expiresAt,
    fromCache: true,
  };
}

export async function putCachedReport(input: {
  lookupKey: string;
  report: PublicReportView;
  ttlMs: number;
}): Promise<CachedReportEntry> {
  const cacheId = generateExtId("cache");
  const cachedAt = new Date().toISOString();
  const reportExpiry = input.report.expiresAt ? new Date(input.report.expiresAt).getTime() : null;
  const ttlExpiry = Date.now() + input.ttlMs;
  const expiresAtMs = reportExpiry != null ? Math.min(reportExpiry, ttlExpiry) : ttlExpiry;
  const expiresAt = new Date(expiresAtMs).toISOString();

  const enc = await encryptJson(input.report);
  await chrome.storage.local.set({ [CACHE_PREFIX + cacheId]: enc });

  const index = (await readIndex()).filter((i) => i.lookupKey !== input.lookupKey);
  index.unshift({ cacheId, lookupKey: input.lookupKey, cachedAt, expiresAt });
  await chrome.storage.local.set({ [CACHE_INDEX_KEY]: index.slice(0, 100) });

  return {
    cacheId,
    lookupKey: input.lookupKey,
    report: input.report,
    cachedAt,
    expiresAt,
    fromCache: false,
  };
}

export async function listCachedReports(): Promise<CacheIndexItem[]> {
  return readIndex();
}

export async function getCachedById(cacheId: string): Promise<CachedReportEntry | null> {
  const index = await readIndex();
  const item = index.find((i) => i.cacheId === cacheId);
  if (!item) return null;
  const stored = await chrome.storage.local.get(CACHE_PREFIX + cacheId);
  const enc = stored[CACHE_PREFIX + cacheId];
  if (typeof enc !== "string") return null;
  const report = await decryptJson<PublicReportView>(enc);
  return {
    cacheId,
    lookupKey: item.lookupKey,
    report,
    cachedAt: item.cachedAt,
    expiresAt: item.expiresAt,
    fromCache: true,
  };
}

export async function clearCache(): Promise<void> {
  const index = await readIndex();
  const keys = index.map((i) => CACHE_PREFIX + i.cacheId);
  if (keys.length) await chrome.storage.local.remove(keys);
  await chrome.storage.local.set({ [CACHE_INDEX_KEY]: [] });
}

async function removeCache(cacheId: string): Promise<void> {
  await chrome.storage.local.remove(CACHE_PREFIX + cacheId);
  const index = (await readIndex()).filter((i) => i.cacheId !== cacheId);
  await chrome.storage.local.set({ [CACHE_INDEX_KEY]: index });
}

async function readIndex(): Promise<CacheIndexItem[]> {
  const stored = await chrome.storage.local.get(CACHE_INDEX_KEY);
  return Array.isArray(stored[CACHE_INDEX_KEY])
    ? (stored[CACHE_INDEX_KEY] as CacheIndexItem[])
    : [];
}
