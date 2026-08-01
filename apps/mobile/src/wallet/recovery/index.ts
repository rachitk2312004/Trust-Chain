import { clearWalletArtifacts, getOrCreateIdentity } from "../identity/store";

/** Lightweight recovery of public identity artifacts after reinstall (no private keys). */
export async function recoverPublicWalletIdentity(displayName?: string) {
  await clearWalletArtifacts();
  return getOrCreateIdentity(displayName);
}
