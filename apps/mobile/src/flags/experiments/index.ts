import { getLocalFlags, setLocalFlags } from "../local/store";

export async function isExperimentEnabled(key: string): Promise<boolean> {
  const flags = await getLocalFlags();
  return Boolean(flags.experiments[key]);
}

export async function setExperiment(key: string, enabled: boolean): Promise<void> {
  const flags = await getLocalFlags();
  await setLocalFlags({ experiments: { ...flags.experiments, [key]: enabled } });
}
