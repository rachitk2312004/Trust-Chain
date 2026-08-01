import { Platform } from "react-native";
import { mmkv } from "../../cache/mmkv";
import type { DeviceRecord } from "../../types/mobile.types";
import { generateMobileId } from "../../utils/ids";

const DEVICE_KEY = "tc.mobile.device";

export async function registerDevice(): Promise<DeviceRecord> {
  const existing = await mmkv.getString(DEVICE_KEY);
  if (existing) return JSON.parse(existing) as DeviceRecord;
  const device: DeviceRecord = {
    deviceId: generateMobileId("device"),
    platform:
      Platform.OS === "android"
        ? "android"
        : Platform.OS === "ios"
          ? "ios"
          : Platform.OS === "web"
            ? "web"
            : "unknown",
    registeredAt: new Date().toISOString(),
    trustLevel: "standard",
    attestationStatus: "unknown",
    status: "active",
  };
  await mmkv.set(DEVICE_KEY, JSON.stringify(device));
  return device;
}

export async function getDevice(): Promise<DeviceRecord | null> {
  const raw = await mmkv.getString(DEVICE_KEY);
  return raw ? (JSON.parse(raw) as DeviceRecord) : null;
}
