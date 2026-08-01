import { Link } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { MobileAppStates } from "@trustchain/config";
import { getHealthMetrics } from "../../src/analytics/health";
import { scheduleOrgSync, runForegroundSync } from "../../src/sync/engine";
import { recordSyncLatency } from "../../src/analytics/health";
import { useAppStore } from "../../src/stores/appStore";
import { formatCacheAge } from "../../src/utils/time";
import { trustBadge } from "../../src/security/signatures/reportValidation";

export default function DashboardScreen() {
  const {
    appState,
    setAppState,
    sessionId,
    accessToken,
    apiBaseUrl,
    lastReport,
    lastFromCache,
    lastCachedAt,
    health,
    setHealth,
    setOrganizations,
  } = useAppStore();

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setAppState(state.isConnected ? MobileAppStates.online : MobileAppStates.offline);
    });
    return () => sub();
  }, [setAppState]);

  async function syncNow() {
    setAppState(MobileAppStates.synchronizing);
    await scheduleOrgSync();
    await runForegroundSync({
      accessToken,
      apiBaseUrl,
      onOrgs: (orgs) => setOrganizations(orgs as never),
      onLatency: (ms) => void recordSyncLatency(ms),
    });
    setHealth(await getHealthMetrics());
    setAppState(MobileAppStates.online);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>TrustChain</Text>
      <Text style={styles.meta}>State: {appState}</Text>
      <Text style={styles.meta}>{sessionId}</Text>
      {lastReport ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{trustBadge(lastReport.verificationResult)}</Text>
          <Text style={styles.meta}>
            {lastFromCache ? `Cached ${formatCacheAge(lastCachedAt)}` : "Live report"}
          </Text>
        </View>
      ) : (
        <Text style={styles.meta}>No verification yet</Text>
      )}
      {health ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health</Text>
          <Text style={styles.meta}>syncLatency: {Math.round(health.syncLatencyMs)}ms</Text>
          <Text style={styles.meta}>
            verificationLatency: {Math.round(health.verificationLatencyMs)}ms
          </Text>
          <Text style={styles.meta}>cacheHitRatio: {(health.cacheHitRatio * 100).toFixed(1)}%</Text>
          <Text style={styles.meta}>queueDepth: {health.queueDepth}</Text>
          <Text style={styles.meta}>networkFailures: {health.networkFailures}</Text>
          <Text style={styles.meta}>batteryImpact: {health.batteryImpact.toFixed(1)}</Text>
        </View>
      ) : null}
      <Pressable style={styles.btn} onPress={() => void syncNow()}>
        <Text style={styles.btnText}>Sync now</Text>
      </Pressable>
      <Link href="/(app)/verify" style={styles.link}>
        Verify a document
      </Link>
      <Link href="/(app)/scanner" style={styles.link}>
        Open scanner
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f4f7f8", gap: 10 },
  brand: { fontSize: 28, fontWeight: "700", color: "#0b1f33" },
  meta: { color: "#64748b", fontSize: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderColor: "#e2e8f0",
    borderWidth: 1,
    gap: 4,
  },
  cardTitle: { fontWeight: "700", color: "#0b1f33" },
  btn: {
    backgroundColor: "#0e7c66",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  link: { color: "#0e7c66", fontWeight: "600" },
});
