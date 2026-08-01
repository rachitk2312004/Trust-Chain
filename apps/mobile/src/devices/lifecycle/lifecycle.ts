import { mmkv } from "../../cache/mmkv";
import { getDevice, registerDevice } from "../registration/register";
import type { DeviceRecord } from "../../types/mobile.types";

export async function revokeDevice(): Promise<DeviceRecord> {
  const device = (await getDevice()) ?? (await registerDevice());
  const updated: DeviceRecord = { ...device, status: "revoked", trustLevel: "untrusted" };
  await mmkv.set("tc.mobile.device", JSON.stringify(updated));
  return updated;
}

export async function replaceDevice(): Promise<DeviceRecord> {
  const previous = await getDevice();
  if (previous) {
    await mmkv.set(
      "tc.mobile.device",
      JSON.stringify({ ...previous, status: "replaced" } satisfies DeviceRecord),
    );
  }
  await mmkv.delete("tc.mobile.device");
  return registerDevice();
}
