import { mmkv } from "../../cache/mmkv";
import type { WalletCredential, WalletIdentity } from "../../types/mobile.types";
import { generateMobileId } from "../../utils/ids";

const IDENTITY_KEY = "tc.mobile.wallet.identity";
const CREDS_KEY = "tc.mobile.wallet.credentials";

export async function getOrCreateIdentity(
  displayName = "TrustChain User",
): Promise<WalletIdentity> {
  const raw = await mmkv.getString(IDENTITY_KEY);
  if (raw) return JSON.parse(raw) as WalletIdentity;
  const identity: WalletIdentity = {
    publicId: generateMobileId("session"),
    displayName,
    createdAt: new Date().toISOString(),
  };
  await mmkv.set(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export async function listCredentials(): Promise<WalletCredential[]> {
  const raw = await mmkv.getString(CREDS_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as WalletCredential[];
}

export async function addVerificationArtifact(
  credential: Omit<WalletCredential, "id">,
): Promise<WalletCredential> {
  const next: WalletCredential = { ...credential, id: generateMobileId("cache") };
  const list = await listCredentials();
  list.unshift(next);
  await mmkv.set(CREDS_KEY, JSON.stringify(list.slice(0, 50)));
  return next;
}

export async function exportPublicProofs(): Promise<{
  identity: WalletIdentity;
  proofs: Array<{ id: string; lookupKey: string; verificationResult: string }>;
}> {
  const identity = await getOrCreateIdentity();
  const creds = await listCredentials();
  return {
    identity,
    proofs: creds.map((c) => ({
      id: c.id,
      lookupKey: c.lookupKey,
      verificationResult: c.report.verificationResult,
    })),
  };
}

export async function clearWalletArtifacts(): Promise<void> {
  await mmkv.delete(CREDS_KEY);
}
