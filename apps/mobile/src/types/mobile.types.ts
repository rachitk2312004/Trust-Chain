import { MobileAppStates, MobileIdPrefixes, MobileSyncPriorities } from "@trustchain/config";

export type MobileAppState = (typeof MobileAppStates)[keyof typeof MobileAppStates];
export type MobileSyncPriority = (typeof MobileSyncPriorities)[keyof typeof MobileSyncPriorities];

export type MobileIdKind = keyof typeof MobileIdPrefixes;

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
  source: "camera" | "gallery" | "clipboard" | "manual";
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug?: string | null;
};

export type DocumentSummary = {
  id: string;
  title: string;
  status: string;
  updatedAt?: string;
};

export type SyncJob = {
  id: string;
  priority: MobileSyncPriority;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  lastError?: string;
};

export type HealthMetrics = {
  syncLatencyMs: number;
  verificationLatencyMs: number;
  cacheHitRatio: number;
  queueDepth: number;
  networkFailures: number;
  batteryImpact: number;
  syncSamples: number;
  verificationSamples: number;
  cacheHits: number;
  cacheMisses: number;
};

export type FeatureFlags = {
  scannerEnabled: boolean;
  syncEnabled: boolean;
  biometricsEnabled: boolean;
  walletEnabled: boolean;
  pushEnabled: boolean;
  experiments: Record<string, boolean>;
};

export type DeviceRecord = {
  deviceId: string;
  platform: "android" | "ios" | "web" | "unknown";
  registeredAt: string;
  trustLevel: "untrusted" | "standard" | "elevated";
  attestationStatus: "unknown" | "passed" | "failed";
  status: "active" | "revoked" | "replaced";
};

export type WalletIdentity = {
  publicId: string;
  displayName: string;
  createdAt: string;
};

export type WalletCredential = {
  id: string;
  kind: "verification_artifact";
  lookupKey: string;
  report: PublicReportView;
  cachedAt: string;
};

export type AppNotification = {
  id: string;
  kind: "verification" | "revocation" | "expiration" | "sync";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};
