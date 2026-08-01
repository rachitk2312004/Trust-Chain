import { getDevice } from "../registration/register";

export async function getDeviceTrustLevel(): Promise<string> {
  const device = await getDevice();
  return device?.trustLevel ?? "untrusted";
}
