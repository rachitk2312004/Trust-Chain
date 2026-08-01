import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getOrCreateSessionId, initFirebaseAuthBridge, loadTokens } from "../src/auth/session";
import { registerDevice } from "../src/devices/registration/register";
import { runDeviceAttestation } from "../src/devices/attestation/attest";
import { getLocalFlags } from "../src/flags/local/store";
import { getOrCreateIdentity } from "../src/wallet/identity/store";
import { useAppStore } from "../src/stores/appStore";
import { getHealthMetrics } from "../src/analytics/health";

export default function SplashScreen() {
  const setSessionId = useAppStore((s) => s.setSessionId);
  const setAccessToken = useAppStore((s) => s.setAccessToken);
  const setFlags = useAppStore((s) => s.setFlags);
  const setHealth = useAppStore((s) => s.setHealth);
  const [ready, setReady] = useState<"auth" | "app" | null>(null);

  useEffect(() => {
    void (async () => {
      const sessionId = await getOrCreateSessionId();
      setSessionId(sessionId);
      await registerDevice();
      await runDeviceAttestation();
      await getOrCreateIdentity();
      await initFirebaseAuthBridge();
      setFlags(await getLocalFlags());
      setHealth(await getHealthMetrics());
      const tokens = await loadTokens(true);
      if (tokens) {
        setAccessToken(tokens.accessToken);
        setReady("app");
      } else {
        setReady("auth");
      }
    })();
  }, [setAccessToken, setFlags, setHealth, setSessionId]);

  if (!ready) {
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>TrustChain</Text>
        <ActivityIndicator color="#0e7c66" />
      </View>
    );
  }

  return <Redirect href={ready === "app" ? "/(app)/dashboard" : "/(auth)/login"} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f2f0",
    gap: 16,
  },
  brand: {
    fontSize: 32,
    fontWeight: "700",
    color: "#0b1f33",
  },
});
