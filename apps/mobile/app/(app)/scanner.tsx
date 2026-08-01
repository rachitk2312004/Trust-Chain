import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { MobileAppStates } from "@trustchain/config";
import { verifyCandidate } from "../../src/api/publicVerify";
import { scanText, candidatesFromQrPayload } from "../../src/scanner";
import { notifyVerificationOutcome } from "../../src/notifications/local";
import { useAppStore } from "../../src/stores/appStore";

export default function ScannerScreen() {
  const apiBaseUrl = useAppStore((s) => s.apiBaseUrl);
  const flags = useAppStore((s) => s.flags);
  const setAppState = useAppStore((s) => s.setAppState);
  const setLastReport = useAppStore((s) => s.setLastReport);
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  if (!flags.scannerEnabled) {
    return (
      <View style={styles.container}>
        <Text>Scanner disabled by feature flag</Text>
      </View>
    );
  }

  async function handlePayload(payload: string, source: "camera" | "clipboard" | "gallery") {
    const candidates =
      source === "clipboard" ? scanText(payload, "clipboard") : candidatesFromQrPayload(payload);
    const candidate = candidates[0];
    if (!candidate) {
      setMessage("No TrustChain identifier found");
      return;
    }
    setAppState(MobileAppStates.verifying);
    const net = await NetInfo.fetch();
    try {
      const result = await verifyCandidate({
        candidate: { ...candidate, source },
        apiBaseUrl,
        online: Boolean(net.isConnected),
      });
      setLastReport(result.report, { fromCache: result.fromCache, cachedAt: result.cachedAt });
      await notifyVerificationOutcome(result.report.verificationResult);
      setMessage(`Verified: ${result.report.verificationResult}`);
      setAppState(result.networkState as never);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Scan failed");
      setAppState(MobileAppStates.failed);
    }
  }

  async function scanClipboard() {
    const text = await Clipboard.getStringAsync();
    await handlePayload(text, "clipboard");
  }

  async function scanGallery() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return;
    // Gallery QR decode without OCR: pass asset URI hint for manual follow-up.
    // Full pixel decode requires native barcode APIs; camera path is primary.
    setMessage(`Image selected: ${picked.assets[0].uri}. Prefer camera QR scan.`);
  }

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera permission required</Text>
        <Pressable style={styles.btn} onPress={() => void requestPermission()}>
          <Text style={styles.btnText}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR scanner</Text>
      <View style={styles.cameraWrap}>
        {scanning ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              setScanning(false);
              void handlePayload(data, "camera").finally(() => {
                setTimeout(() => setScanning(true), 1500);
              });
            }}
          />
        ) : (
          <View style={styles.paused}>
            <Text style={styles.meta}>Processing…</Text>
          </View>
        )}
      </View>
      <Pressable style={styles.btn} onPress={() => void scanClipboard()}>
        <Text style={styles.btnText}>Scan clipboard</Text>
      </Pressable>
      <Pressable style={styles.btnSecondary} onPress={() => void scanGallery()}>
        <Text style={styles.btnSecondaryText}>Pick gallery image</Text>
      </Pressable>
      {message ? <Text style={styles.meta}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f4f7f8", gap: 10 },
  title: { fontSize: 22, fontWeight: "700", color: "#0b1f33" },
  cameraWrap: {
    height: 280,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0f172a",
  },
  paused: { flex: 1, alignItems: "center", justifyContent: "center" },
  btn: { backgroundColor: "#0e7c66", padding: 12, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
  btnSecondary: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnSecondaryText: { color: "#0b1f33", fontWeight: "600" },
  meta: { color: "#64748b", fontSize: 12 },
});
