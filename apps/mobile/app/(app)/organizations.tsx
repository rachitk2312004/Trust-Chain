import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { listOrganizations } from "../../src/api/authAndDocs";
import { useAppStore } from "../../src/stores/appStore";

export default function OrganizationsScreen() {
  const apiBaseUrl = useAppStore((s) => s.apiBaseUrl);
  const accessToken = useAppStore((s) => s.accessToken);
  const organizations = useAppStore((s) => s.organizations);
  const setOrganizations = useAppStore((s) => s.setOrganizations);
  const organizationId = useAppStore((s) => s.organizationId);
  const setOrganizationId = useAppStore((s) => s.setOrganizationId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!accessToken) return;
      try {
        setOrganizations(await listOrganizations(apiBaseUrl, accessToken));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load orgs");
      }
    })();
  }, [accessToken, apiBaseUrl, setOrganizations]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Organizations</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={organizations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, organizationId === item.id && styles.rowActive]}
            onPress={() => setOrganizationId(item.id)}
          >
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.meta}>{item.id}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.meta}>No organizations</Text>}
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
  rowActive: { borderColor: "#0e7c66", backgroundColor: "#ecfdf5" },
  rowTitle: { fontWeight: "600", color: "#0b1f33" },
  meta: { color: "#64748b", fontSize: 12 },
  error: { color: "#b91c1c", marginBottom: 8 },
});
