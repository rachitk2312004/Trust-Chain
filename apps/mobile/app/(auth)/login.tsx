import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { login } from "../../src/api/authAndDocs";
import { getOrCreateSessionId, saveTokens } from "../../src/auth/session";
import { useAppStore } from "../../src/stores/appStore";

export default function LoginScreen() {
  const apiBaseUrl = useAppStore((s) => s.apiBaseUrl);
  const setAccessToken = useAppStore((s) => s.setAccessToken);
  const setSessionId = useAppStore((s) => s.setSessionId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    setLoading(true);
    setError(null);
    try {
      const tokens = await login(apiBaseUrl, email.trim(), password);
      await saveTokens(tokens);
      setAccessToken(tokens.accessToken);
      setSessionId(await getOrCreateSessionId());
      router.replace("/(app)/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.btn} disabled={loading} onPress={() => void onLogin()}>
        <Text style={styles.btnText}>{loading ? "…" : "Login"}</Text>
      </Pressable>
      <Link href="/(auth)/register" style={styles.link}>
        Create account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f4f7f8",
    gap: 12,
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#0b1f33", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  btn: {
    backgroundColor: "#0e7c66",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c" },
  link: { color: "#0e7c66", marginTop: 8 },
});
