import { getDevice, registerDevice } from "../registration/register";
import { mmkv } from "../../cache/mmkv";
import type { DeviceRecord } from "../../types/mobile.types";

/** Soft attestation placeholder — no hardware TEE required in Wave 8. */
export async function runDeviceAttestation(): Promise<DeviceRecord> {
  const device = (await getDevice()) ?? (await registerDevice());
  const updated: DeviceRecord = {
    ...device,
    attestationStatus: "passed",
    trustLevel: device.trustLevel === "untrusted" ? "standard" : device.trustLevel,
  };
  await mmkv.set("tc.mobile.device", JSON.stringify(updated));
  return updated;
}
