import * as LocalAuthentication from "expo-local-authentication";

export async function canUseBiometrics(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  } catch {
    return false;
  }
}

export async function promptBiometrics(reason = "Unlock TrustChain"): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
