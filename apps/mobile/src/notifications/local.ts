import * as Notifications from "expo-notifications";
import { mmkv } from "../cache/mmkv";
import type { AppNotification } from "../types/mobile.types";
import { generateMobileId } from "../utils/ids";

const NOTIF_KEY = "tc.mobile.notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function readAll(): Promise<AppNotification[]> {
  const raw = await mmkv.getString(NOTIF_KEY);
  return raw ? (JSON.parse(raw) as AppNotification[]) : [];
}

async function writeAll(items: AppNotification[]): Promise<void> {
  await mmkv.set(NOTIF_KEY, JSON.stringify(items.slice(0, 100)));
}

export async function pushLocalNotification(input: {
  kind: AppNotification["kind"];
  title: string;
  body: string;
}): Promise<AppNotification> {
  const item: AppNotification = {
    id: generateMobileId("event"),
    kind: input.kind,
    title: input.title,
    body: input.body,
    createdAt: new Date().toISOString(),
    read: false,
  };
  const all = await readAll();
  all.unshift(item);
  await writeAll(all);
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: input.title, body: input.body },
      trigger: null,
    });
  } catch {
    // Expo Go / simulator may deny notifications
  }
  return item;
}

export async function listNotifications(): Promise<AppNotification[]> {
  return readAll();
}

export async function markNotificationRead(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export async function notifyVerificationOutcome(result: string): Promise<void> {
  if (result === "revoked" || result === "tampered") {
    await pushLocalNotification({
      kind: "revocation",
      title: `TrustChain: ${result}`,
      body: "A verification returned a trust warning.",
    });
  } else if (result === "expired") {
    await pushLocalNotification({
      kind: "expiration",
      title: "TrustChain: expired",
      body: "A verification report or document appears expired.",
    });
  } else {
    await pushLocalNotification({
      kind: "verification",
      title: `TrustChain: ${result}`,
      body: "Verification completed.",
    });
  }
}
