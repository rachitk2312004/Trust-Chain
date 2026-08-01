import { Platform } from "react-native";

export function androidAdapter() {
  return {
    id: "android" as const,
    requestCameraPermissionLabel: "Camera access is required to scan QR codes.",
    pinningHosts: ["localhost", "verify.trustchain.com"],
  };
}

export function iosAdapter() {
  return {
    id: "ios" as const,
    requestCameraPermissionLabel: "TrustChain needs the camera to scan verification QR codes.",
    pinningHosts: ["localhost", "verify.trustchain.com"],
    faceIdUsage: "Unlock your TrustChain session",
  };
}

export function sharedAdapter() {
  return {
    id: "shared" as const,
    platform: Platform.OS,
  };
}

export function getPlatformAdapter() {
  if (Platform.OS === "android") return androidAdapter();
  if (Platform.OS === "ios") return iosAdapter();
  return sharedAdapter();
}
