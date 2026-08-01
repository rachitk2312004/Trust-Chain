import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { MobileAppStates } from "@trustchain/config";
import { verifyManualInput } from "../../src/api/publicVerify";
import { recordEvent } from "../../src/analytics/events";
import { notifyVerificationOutcome } from "../../src/notifications/local";
import { addVerificationArtifact } from "../../src/wallet/credentials";
import { lookupKeyForCandidate, detectCandidates } from "../../src/utils/detectors";
import { formatCacheAge } from "../../src/utils/time";
import { trustBadge, isWarningOutcome } from "../../src/security/signatures/reportValidation";
import { useAppStore } from "../../src/stores/appStore";

export default function VerifyScreen() {
  const apiBaseUrl = useAppStore((s) => s.apiBaseUrl);
  const setAppState = useAppStore((s) => s.setAppState);
  const setLastReport = useAppStore((s) => s.setLastReport);
  const lastReport = useAppStore((s) => s.lastReport);
  const lastFromCache = useAppStore((s) => s.lastFromCache);
  const lastCachedAt = useAppStore((s) => s.lastCachedAt);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onVerify() {
    setError(null);
    setAppState(MobileAppStates.verifying);
    try {
      const net = await NetInfo.fetch();
      const result = await verifyManualInput({
        text: input,
        apiBaseUrl,
        online: Boolean(net.isConnected),
      });
      setLastReport(result.report, { fromCache: result.fromCache, cachedAt: result.cachedAt });
      const candidate = detectCandidates(input, "manual")[0];
      if (candidate) {
        await addVerificationArtifact({
          kind: "verification_artifact",
          lookupKey: lookupKeyForCandidate(candidate),
          report: result.report,
          cachedAt: result.cachedAt ?? new Date().toISOString(),
        });
      }
      await recordEvent({
        kind: "verify",
        success: true,
        outcome: result.report.verificationResult,
      });
      await notifyVerificationOutcome(result.report.verificationResult);
      setAppState(result.networkState as never);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Verify failed";
      setError(message);
      setAppState(
        message === "MOBILE_RATE_LIMITED" ? MobileAppStates.blocked : MobileAppStates.failed,
      );
      await recordEvent({ kind: "verify", success: false });
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Public verification</Text>
      <Text style={styles.meta}>Uses Wave 5/6 APIs only — never local chain checks</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="VERIFY-… / PUB-VERIFY-… / hash / URL / token"
        value={input}
        onChangeText={setInput}
      />
      <Pressable style={styles.btn} onPress={() => void onVerify()}>
        <Text style={styles.btnText}>Verify</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {lastReport ? (
        <View style={styles.card}>
          <Text
            style={[
              styles.badge,
              isWarningOutcome(lastReport.verificationResult) && styles.badgeWarn,
            ]}
          >
            {trustBadge(lastReport.verificationResult)}
          </Text>
          <Text style={styles.meta}>
            {lastFromCache ? `Cached ${formatCacheAge(lastCachedAt)}` : "Live"}
          </Text>
          <Text style={styles.meta}>Integrity: {String(lastReport.proofOfIntegrity ?? "—")}</Text>
          <Text style={styles.meta}>Network: {String(lastReport.networkName ?? "—")}</Text>
          <Text style={styles.meta}>Tx: {String(lastReport.transactionHash ?? "—")}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f4f7f8", gap: 10 },
  title: { fontSize: 22, fontWeight: "700", color: "#0b1f33" },
  meta: { color: "#64748b", fontSize: 12 },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    textAlignVertical: "top",
  },
  btn: { backgroundColor: "#0e7c66", padding: 12, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  badge: { fontWeight: "700", color: "#065f46" },
  badgeWarn: { color: "#b91c1c" },
});
