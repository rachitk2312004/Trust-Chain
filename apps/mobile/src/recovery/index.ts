import { clearTokens, getOrCreateSessionId } from "../auth/session";
import { clearReportCache } from "../cache/reportCache";
import { createRawKeyBase64 } from "../security/encryption/crypto";
import { mmkv } from "../cache/mmkv";
import { recoverPublicWalletIdentity } from "../wallet/recovery";
import { replaceDevice } from "../devices/lifecycle/lifecycle";

export async function recoverSessionScaffold(): Promise<{ sessionId: string }> {
  await clearTokens();
  const sessionId = await getOrCreateSessionId();
  return { sessionId };
}

export async function recoverCache(): Promise<void> {
  await clearReportCache();
}

export async function rotateLocalKeys(): Promise<void> {
  await mmkv.set("tc.mobile.key", createRawKeyBase64());
  await clearReportCache();
}

export async function runRecoveryMigration(version = 1): Promise<{ version: number }> {
  await mmkv.set("tc.mobile.recovery.version", String(version));
  await recoverPublicWalletIdentity();
  await replaceDevice();
  return { version };
}

export async function fullLocalRecovery(): Promise<void> {
  await recoverSessionScaffold();
  await recoverCache();
  await rotateLocalKeys();
  await runRecoveryMigration(1);
}
