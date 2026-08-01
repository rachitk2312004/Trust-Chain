import { mmkv } from "../cache/mmkv";
import { generateMobileId } from "../utils/ids";

export type MobileAnalyticsEvent = {
  eventId: string;
  kind: string;
  success: boolean;
  outcome?: string;
  createdAt: string;
};

const EVENTS_KEY = "tc.mobile.events";

export async function recordEvent(input: {
  kind: string;
  success: boolean;
  outcome?: string;
}): Promise<MobileAnalyticsEvent> {
  const event: MobileAnalyticsEvent = {
    eventId: generateMobileId("event"),
    kind: input.kind,
    success: input.success,
    outcome: input.outcome,
    createdAt: new Date().toISOString(),
  };
  const raw = await mmkv.getString(EVENTS_KEY);
  const prev = raw ? (JSON.parse(raw) as MobileAnalyticsEvent[]) : [];
  await mmkv.set(EVENTS_KEY, JSON.stringify([event, ...prev].slice(0, 200)));
  return event;
}

export async function listEvents(): Promise<MobileAnalyticsEvent[]> {
  const raw = await mmkv.getString(EVENTS_KEY);
  return raw ? (JSON.parse(raw) as MobileAnalyticsEvent[]) : [];
}
