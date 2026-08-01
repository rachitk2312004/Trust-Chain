import { generateExtId } from "../utils/ids.js";

export type ExtAnalyticsEvent = {
  eventId: string;
  kind: string;
  outcome?: string;
  success: boolean;
  meta?: Record<string, unknown>;
  createdAt: string;
};

const EVENTS_KEY = "tc_ext_events";
const MAX_EVENTS = 200;

export async function recordExtEvent(input: {
  kind: string;
  outcome?: string;
  success: boolean;
  meta?: Record<string, unknown>;
  enabled: boolean;
}): Promise<ExtAnalyticsEvent | null> {
  if (!input.enabled) return null;
  const event: ExtAnalyticsEvent = {
    eventId: generateExtId("event"),
    kind: input.kind,
    outcome: input.outcome,
    success: input.success,
    meta: input.meta,
    createdAt: new Date().toISOString(),
  };
  const stored = await chrome.storage.local.get(EVENTS_KEY);
  const prev = Array.isArray(stored[EVENTS_KEY]) ? (stored[EVENTS_KEY] as ExtAnalyticsEvent[]) : [];
  const next = [event, ...prev].slice(0, MAX_EVENTS);
  await chrome.storage.local.set({ [EVENTS_KEY]: next });
  return event;
}

export async function listExtEvents(): Promise<ExtAnalyticsEvent[]> {
  const stored = await chrome.storage.local.get(EVENTS_KEY);
  return Array.isArray(stored[EVENTS_KEY]) ? (stored[EVENTS_KEY] as ExtAnalyticsEvent[]) : [];
}
