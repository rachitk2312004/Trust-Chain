import { getRedis } from "../../lib/redis.js";

const THREAD_TTL_SEC = 10 * 60;
const INBOX_TTL_SEC = 45;
const AUTH_TTL_SEC = 5 * 60;
const REV_TTL_SEC = 24 * 60 * 60;
const MEMORY_MAX = 400;

type MemoryEntry = { value: string; expiresAt: number };

const memory = new Map<string, MemoryEntry>();

export type CachedChatMember = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  lastSeenAt?: string | null;
  online?: boolean;
};

export type CachedChatMessage = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  sender: CachedChatMember;
};

export type CachedInbox = {
  conversations: unknown[];
};

export type ConversationAuth = {
  organizationId: string;
  memberIds: string[];
};

export function inboxCacheKey(organizationId: string, userId: string): string {
  return `msg:inbox:${organizationId}:${userId}`;
}

export function threadCacheKey(conversationId: string): string {
  return `msg:thread:${conversationId}`;
}

export function inboxRevKey(organizationId: string, userId: string): string {
  return `msg:rev:${organizationId}:${userId}`;
}

export function threadHeadKey(conversationId: string): string {
  return `msg:head:${conversationId}`;
}

export function conversationAuthKey(conversationId: string): string {
  return `msg:auth:${conversationId}`;
}

export function presenceKey(userId: string): string {
  return `msg:seen:${userId}`;
}

export function hiddenKey(userId: string, conversationId: string): string {
  return `msg:hidden:${userId}:${conversationId}`;
}

export function filterVisibleMessages<T extends { id: string }>(
  messages: T[],
  hiddenIds: Iterable<string>,
): T[] {
  const hidden = new Set(hiddenIds);
  return messages.filter((message) => !hidden.has(message.id));
}

export const PRESENCE_ONLINE_MS = 2 * 60 * 1000;

export function shouldServeThreadFromCache(query: { after?: string }): boolean {
  return !query.after;
}

function pruneMemory(): void {
  if (memory.size <= MEMORY_MAX) return;
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }
  if (memory.size <= MEMORY_MAX) return;
  const extra = memory.size - MEMORY_MAX;
  let removed = 0;
  for (const key of memory.keys()) {
    memory.delete(key);
    removed += 1;
    if (removed >= extra) break;
  }
}

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSec: number): void {
  memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  pruneMemory();
}

function memoryDel(key: string): void {
  memory.delete(key);
}

async function cacheGet(key: string): Promise<string | null> {
  const client = await getRedis();
  if (client) {
    try {
      const value = await client.get(key);
      if (value != null) return value;
    } catch {
      /* use memory */
    }
  }
  return memoryGet(key);
}

async function cacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  memorySet(key, value, ttlSec);
  const client = await getRedis();
  if (!client) return;
  try {
    await client.set(key, value, { EX: ttlSec });
  } catch {
    /* memory already written */
  }
}

async function cacheDel(key: string): Promise<void> {
  memoryDel(key);
  const client = await getRedis();
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    /* ignore */
  }
}

export async function cacheBackend(): Promise<"redis" | "memory"> {
  return (await getRedis()) ? "redis" : "memory";
}

export async function getCachedInbox(
  organizationId: string,
  userId: string,
): Promise<CachedInbox | null> {
  const raw = await cacheGet(inboxCacheKey(organizationId, userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedInbox;
    return Array.isArray(parsed.conversations) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setCachedInbox(
  organizationId: string,
  userId: string,
  conversations: unknown[],
): Promise<void> {
  await cacheSet(
    inboxCacheKey(organizationId, userId),
    JSON.stringify({ conversations }),
    INBOX_TTL_SEC,
  );
  const existing = await getInboxRev(organizationId, userId);
  if (existing == null) {
    await cacheSet(inboxRevKey(organizationId, userId), "0", REV_TTL_SEC);
  }
}

export async function getCachedThread(conversationId: string): Promise<CachedChatMessage[] | null> {
  const raw = await cacheGet(threadCacheKey(conversationId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedChatMessage[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setCachedThread(
  conversationId: string,
  messages: CachedChatMessage[],
): Promise<void> {
  await cacheSet(threadCacheKey(conversationId), JSON.stringify(messages), THREAD_TTL_SEC);
  const last = messages[messages.length - 1];
  if (last) {
    await cacheSet(threadHeadKey(conversationId), last.id, THREAD_TTL_SEC);
  }
}

export async function getConversationAuth(
  conversationId: string,
): Promise<ConversationAuth | null> {
  const raw = await cacheGet(conversationAuthKey(conversationId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConversationAuth;
    if (!parsed.organizationId || !Array.isArray(parsed.memberIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setConversationAuth(
  conversationId: string,
  auth: ConversationAuth,
): Promise<void> {
  await cacheSet(conversationAuthKey(conversationId), JSON.stringify(auth), AUTH_TTL_SEC);
}

export async function getInboxRev(organizationId: string, userId: string): Promise<number | null> {
  const raw = await cacheGet(inboxRevKey(organizationId, userId));
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function getThreadHead(conversationId: string): Promise<string | null> {
  return cacheGet(threadHeadKey(conversationId));
}

export async function recordPostedMessage(input: {
  organizationId: string;
  conversationId: string;
  memberIds: string[];
  message: CachedChatMessage;
}): Promise<void> {
  const current = (await getCachedThread(input.conversationId)) ?? [];
  const next = current.some((row) => row.id === input.message.id)
    ? current
    : [...current, input.message].slice(-80);
  await setCachedThread(input.conversationId, next);
  await Promise.all(
    input.memberIds.map(async (userId) => {
      await cacheDel(inboxCacheKey(input.organizationId, userId));
      const rev = (await getInboxRev(input.organizationId, userId)) ?? 0;
      await cacheSet(inboxRevKey(input.organizationId, userId), String(rev + 1), REV_TTL_SEC);
    }),
  );
}

export async function bumpInbox(organizationId: string, userIds: string[]): Promise<void> {
  await Promise.all(
    userIds.map(async (userId) => {
      await cacheDel(inboxCacheKey(organizationId, userId));
      const rev = (await getInboxRev(organizationId, userId)) ?? 0;
      await cacheSet(inboxRevKey(organizationId, userId), String(rev + 1), REV_TTL_SEC);
    }),
  );
}

export async function patchCachedThread(
  conversationId: string,
  updater: (messages: CachedChatMessage[]) => CachedChatMessage[],
): Promise<void> {
  const current = await getCachedThread(conversationId);
  if (!current) return;
  await setCachedThread(conversationId, updater(current));
}

export async function clearConversationAuth(conversationId: string): Promise<void> {
  await cacheDel(conversationAuthKey(conversationId));
}

export async function getHiddenIds(userId: string, conversationId: string): Promise<string[] | null> {
  const raw = await cacheGet(hiddenKey(userId, conversationId));
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function setHiddenIds(
  userId: string,
  conversationId: string,
  messageIds: string[],
): Promise<void> {
  await cacheSet(hiddenKey(userId, conversationId), JSON.stringify([...new Set(messageIds)]), REV_TTL_SEC);
}

export async function addHiddenIds(
  userId: string,
  conversationId: string,
  messageIds: string[],
): Promise<string[]> {
  const current = (await getHiddenIds(userId, conversationId)) ?? [];
  const next = [...new Set([...current, ...messageIds])];
  await setHiddenIds(userId, conversationId, next);
  return next;
}

export async function touchPresence(userId: string): Promise<void> {
  await cacheSet(presenceKey(userId), new Date().toISOString(), 5 * 60);
}

export async function getPresenceMap(userIds: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(userIds)];
  const entries = await Promise.all(
    unique.map(async (userId) => [userId, await cacheGet(presenceKey(userId))] as const),
  );
  const result: Record<string, string> = {};
  for (const [userId, value] of entries) {
    if (value) result[userId] = value;
  }
  return result;
}

export function laterIso(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

export function isOnline(lastSeenAt?: string | null, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const at = Date.parse(lastSeenAt);
  return Number.isFinite(at) && now - at < PRESENCE_ONLINE_MS;
}

export function resetMessageCacheForTests(): void {
  memory.clear();
}
