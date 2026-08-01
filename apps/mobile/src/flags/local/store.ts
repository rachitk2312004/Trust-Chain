import { mmkv } from "../../cache/mmkv";
import type { FeatureFlags } from "../../types/mobile.types";

const FLAGS_KEY = "tc.mobile.flags";

export const defaultFlags = (): FeatureFlags => ({
  scannerEnabled: true,
  syncEnabled: true,
  biometricsEnabled: true,
  walletEnabled: true,
  pushEnabled: true,
  experiments: {},
});

export async function getLocalFlags(): Promise<FeatureFlags> {
  const raw = await mmkv.getString(FLAGS_KEY);
  if (!raw) return defaultFlags();
  return { ...defaultFlags(), ...(JSON.parse(raw) as FeatureFlags) };
}

export async function setLocalFlags(patch: Partial<FeatureFlags>): Promise<FeatureFlags> {
  const current = await getLocalFlags();
  const next = {
    ...current,
    ...patch,
    experiments: { ...current.experiments, ...(patch.experiments ?? {}) },
  };
  await mmkv.set(FLAGS_KEY, JSON.stringify(next));
  return next;
}
