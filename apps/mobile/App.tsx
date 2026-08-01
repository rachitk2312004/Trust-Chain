import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TrustChain</Text>
      <Text style={styles.subtitle}>Trust every document. Verify in seconds.</Text>
      <Text style={styles.meta}>API: {apiUrl}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 16,
  },
  meta: {
    fontSize: 12,
    color: "#94a3b8",
  },
});
