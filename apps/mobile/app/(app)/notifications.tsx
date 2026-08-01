import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { listNotifications } from "../../src/notifications/local";
import type { AppNotification } from "../../src/types/mobile.types";

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    void listNotifications().then(setItems);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.meta}>{item.body}</Text>
            <Text style={styles.meta}>
              {item.kind} · {item.createdAt}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.meta}>No alerts yet</Text>}
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
});
