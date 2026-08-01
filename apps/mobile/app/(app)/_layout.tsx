import { Tabs } from "expo-router";

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#e8f2f0" },
        headerTintColor: "#0b1f33",
        tabBarActiveTintColor: "#0e7c66",
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Home" }} />
      <Tabs.Screen name="organizations" options={{ title: "Orgs" }} />
      <Tabs.Screen name="documents/index" options={{ title: "Docs", href: "/documents" }} />
      <Tabs.Screen name="documents/[documentId]" options={{ href: null, title: "Document" }} />
      <Tabs.Screen name="verify" options={{ title: "Verify" }} />
      <Tabs.Screen name="scanner" options={{ title: "Scan" }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
