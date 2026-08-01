import {
  ExtensionIdPrefixes,
  ExtensionLifecycleStates,
  ExtensionNetworkStates,
} from "@trustchain/config";

export type ExtensionLifecycleState =
  (typeof ExtensionLifecycleStates)[keyof typeof ExtensionLifecycleStates];

export type ExtensionNetworkState =
  (typeof ExtensionNetworkStates)[keyof typeof ExtensionNetworkStates];

export type ExtensionIdPrefix = (typeof ExtensionIdPrefixes)[keyof typeof ExtensionIdPrefixes];

export type ScanCandidateType =
  | "verification_code"
  | "public_verify_code"
  | "hash"
  | "link_token"
  | "qr_token"
  | "tx"
  | "url";

export type ScanCandidate = {
  type: ScanCandidateType;
  value: string;
  source: "page" | "clipboard" | "manual" | "context" | "image" | "dnd" | "qr";
};

export type PublicReportView = {
  verificationResult: string;
  publicVerifyCode?: string | null;
  verificationCode?: string | null;
  contentHash?: string | null;
  proofOfIntegrity?: string | null;
  proofTimestamp?: string | null;
  networkName?: string | null;
  transactionHash?: string | null;
  blockNumber?: string | number | null;
  reportSignature?: string;
  reportChecksum?: string;
  issuedAt?: string;
  expiresAt?: string;
  [key: string]: unknown;
};

export type CachedReportEntry = {
  cacheId: string;
  lookupKey: string;
  report: PublicReportView;
  cachedAt: string;
  expiresAt: string | null;
  fromCache: boolean;
};

export type VerifyResult = {
  report: PublicReportView;
  cacheId: string | null;
  fromCache: boolean;
  cachedAt: string | null;
  networkState: ExtensionNetworkState;
  latencyMs: number;
};

export type ExtensionSettings = {
  apiBaseUrl: string;
  autoScanEnabled: boolean;
  clipboardScanEnabled: boolean;
  notificationsEnabled: boolean;
  analyticsEnabled: boolean;
  cacheTtlMs: number;
  extensionEnabled: boolean;
};

export type HealthMetrics = {
  scanAttempts: number;
  scanSuccesses: number;
  scanSuccessRate: number;
  verificationCount: number;
  verificationLatencyTotalMs: number;
  verificationLatencyAvgMs: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio: number;
  networkFailures: number;
};

export type ExtensionMessage =
  | { type: "GET_STATE" }
  | { type: "SET_SETTINGS"; settings: Partial<ExtensionSettings> }
  | { type: "SCAN_PAGE" }
  | { type: "VERIFY_CANDIDATE"; candidate: ScanCandidate }
  | { type: "VERIFY_MANUAL"; input: string }
  | { type: "GET_HISTORY" }
  | { type: "CLEAR_CACHE" }
  | { type: "GET_HEALTH" }
  | { type: "EXPORT_REPORT"; cacheId?: string }
  | { type: "CANDIDATES_FOUND"; candidates: ScanCandidate[] }
  | { type: "DECODE_IMAGE_QR"; imageUrl: string };

export type ExtensionStateSnapshot = {
  sessionId: string;
  lifecycle: ExtensionLifecycleState;
  network: ExtensionNetworkState;
  settings: ExtensionSettings;
  lastResult: VerifyResult | null;
  lastError: string | null;
  health: HealthMetrics;
};
