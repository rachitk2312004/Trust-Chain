import {
  createRawKeyBase64,
  decryptJson,
  encryptJson,
  importAesKey,
} from "../security/encryption/crypto";
import type { PublicReportView } from "../types/mobile.types";
import { generateMobileId } from "../utils/ids";
import { mmkv } from "./mmkv";

const KEY_MATERIAL = "tc.mobile.key";
const INDEX_KEY = "tc.mobile.cache.index";
const PREFIX = "tc.mobile.cache.";

type IndexItem = {
  cacheId: string;
  lookupKey: string;
  cachedAt: string;
  expiresAt: string | null;
};

async function getCryptoKey(): Promise<CryptoKey> {
  let raw = await mmkv.getString(KEY_MATERIAL);
  if (!raw) {
    raw = createRawKeyBase64();
    await mmkv.set(KEY_MATERIAL, raw);
  }
  return importAesKey(raw);
}

async function readIndex(): Promise<IndexItem[]> {
  const raw = await mmkv.getString(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as IndexItem[];
  } catch {
    return [];
  }
}

async function writeIndex(index: IndexItem[]): Promise<void> {
  await mmkv.set(INDEX_KEY, JSON.stringify(index.slice(0, 100)));
}

export async function getCachedReport(lookupKey: string): Promise<{
  cacheId: string;
  report: PublicReportView;
  cachedAt: string;
  expiresAt: string | null;
} | null> {
  const index = await readIndex();
  const item = index.find((i) => i.lookupKey === lookupKey);
  if (!item) return null;
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()) {
    await removeCached(item.cacheId);
    return null;
  }
  const enc = await mmkv.getString(PREFIX + item.cacheId);
  if (!enc) return null;
  const key = await getCryptoKey();
  const report = await decryptJson<PublicReportView>(key, enc);
  return { cacheId: item.cacheId, report, cachedAt: item.cachedAt, expiresAt: item.expiresAt };
}

export async function putCachedReport(input: {
  lookupKey: string;
  report: PublicReportView;
  ttlMs: number;
}): Promise<{ cacheId: string; cachedAt: string }> {
  const cacheId = generateMobileId("cache");
  const cachedAt = new Date().toISOString();
  const reportExpiry = input.report.expiresAt
    ? new Date(input.report.expiresAt).getTime()
    : null;
  const expiresAtMs =
    reportExpiry != null ? Math.min(reportExpiry, Date.now() + input.ttlMs) : Date.now() + input.ttlMs;
  const key = await getCryptoKey();
  const enc = await encryptJson(key, input.report);
  await mmkv.set(PREFIX + cacheId, enc);
  const index = (await readIndex()).filter((i) => i.lookupKey !== input.lookupKey);
  index.unshift({
    cacheId,
    lookupKey: input.lookupKey,
    cachedAt,
    expiresAt: new Date(expiresAtMs).toISOString(),
  });
  await writeIndex(index);
  return { cacheId, cachedAt };
}

export async function listCachedReports(): Promise<IndexItem[]> {
  return readIndex();
}

export async function clearReportCache(): Promise<void> {
  const index = await readIndex();
  for (const item of index) await mmkv.delete(PREFIX + item.cacheId);
  await writeIndex([]);
}

async function removeCached(cacheId: string): Promise<void> {
  await mmkv.delete(PREFIX + cacheId);
  await writeIndex((await readIndex()).filter((i) => i.cacheId !== cacheId));
}
