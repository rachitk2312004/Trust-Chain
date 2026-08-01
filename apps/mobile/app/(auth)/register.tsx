import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { register } from "../../src/api/authAndDocs";
import { useAppStore } from "../../src/stores/appStore";

export default function RegisterScreen() {
  const apiBaseUrl = useAppStore((s) => s.apiBaseUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onRegister() {
    setError(null);
    try {
      await register(apiBaseUrl, { email: email.trim(), password, firstName });
      router.replace("/(auth)/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Register failed");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput
        style={styles.input}
        placeholder="First name"
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={styles.input}
        autoCapitalize="none"
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
      <Pressable style={styles.btn} onPress={() => void onRegister()}>
        <Text style={styles.btnText}>Register</Text>
      </Pressable>
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
  title: { fontSize: 24, fontWeight: "700", color: "#0b1f33" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  btn: { backgroundColor: "#0e7c66", padding: 14, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c" },
});
