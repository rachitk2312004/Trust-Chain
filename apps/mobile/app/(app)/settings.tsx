import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { clearTokens, setBiometricsEnabled, isBiometricsEnabled } from "../../src/auth/session";
import { clearReportCache } from "../../src/cache/reportCache";
import { getLocalFlags, setLocalFlags } from "../../src/flags/local/store";
import { fullLocalRecovery } from "../../src/recovery";
import { getDevice } from "../../src/devices/registration/register";
import { exportPublicProofs } from "../../src/wallet/proofs";
import { useAppStore } from "../../src/stores/appStore";
import { assertApiUrl } from "../../src/security/sandbox/sanitize";

export default function SettingsScreen() {
  const apiBaseUrl = useAppStore((s) => s.apiBaseUrl);
  const setApiBaseUrl = useAppStore((s) => s.setApiBaseUrl);
  const setAccessToken = useAppStore((s) => s.setAccessToken);
  const flags = useAppStore((s) => s.flags);
  const setFlags = useAppStore((s) => s.setFlags);
  const [url, setUrl] = useState(apiBaseUrl);
  const [bio, setBio] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("");
  const [walletId, setWalletId] = useState<string>("");

  useEffect(() => {
    void isBiometricsEnabled().then(setBio);
    void getDevice().then((d) => setDeviceId(d?.deviceId ?? ""));
    void exportPublicProofs().then((p) => setWalletId(p.identity.publicId));
    void getLocalFlags().then(setFlags);
  }, [setFlags]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.meta}>Device: {deviceId}</Text>
      <Text style={styles.meta}>Wallet identity: {walletId}</Text>
      <Text style={styles.label}>API base URL</Text>
      <TextInput style={styles.input} value={url} onChangeText={setUrl} autoCapitalize="none" />
      <Pressable
        style={styles.btn}
        onPress={() => {
          try {
            setApiBaseUrl(assertApiUrl(url));
          } catch {
            // ignore invalid
          }
        }}
      >
        <Text style={styles.btnText}>Save API URL</Text>
      </Pressable>

      <View style={styles.row}>
        <Text>Biometrics</Text>
        <Switch
          value={bio}
          onValueChange={(v) => {
            setBio(v);
            void setBiometricsEnabled(v);
          }}
        />
      </View>
      <View style={styles.row}>
        <Text>Scanner flag</Text>
        <Switch
          value={flags.scannerEnabled}
          onValueChange={(v) => void setLocalFlags({ scannerEnabled: v }).then(setFlags)}
        />
      </View>
      <View style={styles.row}>
        <Text>Sync flag</Text>
        <Switch
          value={flags.syncEnabled}
          onValueChange={(v) => void setLocalFlags({ syncEnabled: v }).then(setFlags)}
        />
      </View>

      <Pressable style={styles.btnSecondary} onPress={() => void clearReportCache()}>
        <Text>Clear report cache</Text>
      </Pressable>
      <Pressable style={styles.btnSecondary} onPress={() => void fullLocalRecovery()}>
        <Text>Run local recovery</Text>
      </Pressable>
      <Pressable
        style={styles.btnDanger}
        onPress={() => {
          void clearTokens().then(() => {
            setAccessToken(null);
            router.replace("/(auth)/login");
          });
        }}
      >
        <Text style={styles.btnText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f4f7f8", gap: 10 },
  title: { fontSize: 22, fontWeight: "700", color: "#0b1f33" },
  label: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  meta: { fontSize: 12, color: "#64748b" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
  },
  btn: { backgroundColor: "#0e7c66", padding: 12, borderRadius: 8, alignItems: "center" },
  btnSecondary: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  btnDanger: { backgroundColor: "#b91c1c", padding: 12, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
});
