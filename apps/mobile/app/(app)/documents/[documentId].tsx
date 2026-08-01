import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { getDocument } from "../../../src/api/authAndDocs";
import { useAppStore } from "../../../src/stores/appStore";

export default function DocumentViewerScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const apiBaseUrl = useAppStore((s) => s.apiBaseUrl);
  const accessToken = useAppStore((s) => s.accessToken);
  const organizationId = useAppStore((s) => s.organizationId);
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!accessToken || !organizationId || !documentId) return;
      try {
        setDoc(await getDocument(apiBaseUrl, accessToken, organizationId, documentId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load document");
      }
    })();
  }, [accessToken, apiBaseUrl, documentId, organizationId]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Document</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.meta}>{documentId}</Text>
      <Text style={styles.body}>{doc ? JSON.stringify(doc, null, 2) : "Loading…"}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f4f7f8", gap: 8 },
  title: { fontSize: 22, fontWeight: "700", color: "#0b1f33" },
  meta: { color: "#64748b", fontSize: 12 },
  body: {
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    padding: 12,
    borderRadius: 8,
    fontSize: 11,
    fontFamily: "Courier",
  },
  error: { color: "#b91c1c" },
});
