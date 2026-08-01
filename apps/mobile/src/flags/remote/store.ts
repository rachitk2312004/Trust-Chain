import { setLocalFlags } from "../local/store";
import type { FeatureFlags } from "../../types/mobile.types";

/**
 * Remote flags stub — Wave 8 reads local only.
 * Wave 9/10 can replace fetchRemoteFlags with a real endpoint (not webhooks).
 */
export async function fetchRemoteFlags(_apiBaseUrl: string): Promise<Partial<FeatureFlags>> {
  return {};
}

export async function mergeRemoteFlags(apiBaseUrl: string): Promise<FeatureFlags> {
  const remote = await fetchRemoteFlags(apiBaseUrl);
  return setLocalFlags(remote);
}
