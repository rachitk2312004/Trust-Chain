import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { listDocuments } from "../../../src/api/authAndDocs";
import { useAppStore } from "../../../src/stores/appStore";

export default function DocumentsScreen() {
  const apiBaseUrl = useAppStore((s) => s.apiBaseUrl);
  const accessToken = useAppStore((s) => s.accessToken);
  const organizationId = useAppStore((s) => s.organizationId);
  const documents = useAppStore((s) => s.documents);
  const setDocuments = useAppStore((s) => s.setDocuments);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!accessToken || !organizationId) return;
      try {
        setDocuments(await listDocuments(apiBaseUrl, accessToken, organizationId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load documents");
      }
    })();
  }, [accessToken, apiBaseUrl, organizationId, setDocuments]);

  if (!organizationId) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Select an organization first.</Text>
        <Link href="/(app)/organizations">Go to organizations</Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Documents</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={`/(app)/documents/${item.id}`} style={styles.row}>
            <Text style={styles.rowTitle}>{item.title || item.id}</Text>
            <Text style={styles.meta}>{item.status}</Text>
          </Link>
        )}
        ListEmptyComponent={<Text style={styles.meta}>No documents</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f4f7f8" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12, color: "#0b1f33" },
  row: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rowTitle: { fontWeight: "600", color: "#0b1f33" },
  meta: { color: "#64748b", fontSize: 12 },
  error: { color: "#b91c1c" },
});
