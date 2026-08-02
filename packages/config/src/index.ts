/** Environment variable names shared across TrustChain packages. */
export const EnvKeys = {
  NODE_ENV: "NODE_ENV",
  PORT: "PORT",
  DATABASE_URL: "DATABASE_URL",
  CORS_ORIGIN: "CORS_ORIGIN",
  REDIS_URL: "REDIS_URL",
  VITE_API_URL: "VITE_API_URL",
  EXPO_PUBLIC_API_URL: "EXPO_PUBLIC_API_URL",
  R2_ACCOUNT_ID: "R2_ACCOUNT_ID",
  R2_ACCESS_KEY_ID: "R2_ACCESS_KEY_ID",
  R2_SECRET_ACCESS_KEY: "R2_SECRET_ACCESS_KEY",
  R2_BUCKET: "R2_BUCKET",
  R2_ENDPOINT: "R2_ENDPOINT",
  R2_REGION: "R2_REGION",
  SMTP_HOST: "SMTP_HOST",
  SMTP_PORT: "SMTP_PORT",
  SMTP_USER: "SMTP_USER",
  SMTP_PASS: "SMTP_PASS",
  SMTP_FROM: "SMTP_FROM",
  CHAIN_RPC_URL: "CHAIN_RPC_URL",
  CHAIN_NETWORK: "CHAIN_NETWORK",
  CHAIN_PRIVATE_KEY: "CHAIN_PRIVATE_KEY",
  CHAIN_ENABLED: "CHAIN_ENABLED",
  CHAIN_DOCUMENT_REGISTRY_ADDRESS: "CHAIN_DOCUMENT_REGISTRY_ADDRESS",
  CHAIN_CONFIRMATIONS: "CHAIN_CONFIRMATIONS",
  PUBLIC_VERIFY_SIGNING_SECRET: "PUBLIC_VERIFY_SIGNING_SECRET",
  PUBLIC_VERIFY_BASE_URL: "PUBLIC_VERIFY_BASE_URL",
  JWT_ACCESS_SECRET: "JWT_ACCESS_SECRET",
  JWT_ACCESS_EXPIRES_IN: "JWT_ACCESS_EXPIRES_IN",
  JWT_REFRESH_EXPIRES_DAYS: "JWT_REFRESH_EXPIRES_DAYS",
  MFA_ENCRYPTION_KEY: "MFA_ENCRYPTION_KEY",
  DOCUMENT_KEY_V1: "DOCUMENT_KEY_V1",
  DOCUMENT_KEY_V2: "DOCUMENT_KEY_V2",
  DOCUMENT_KEY_V3: "DOCUMENT_KEY_V3",
  DOCUMENT_ACTIVE_KEY_VERSION: "DOCUMENT_ACTIVE_KEY_VERSION",
  DOCUMENT_ENCRYPTION_ENABLED: "DOCUMENT_ENCRYPTION_ENABLED",
  MALWARE_SCANNER: "MALWARE_SCANNER",
  MALWARE_SCAN_URL: "MALWARE_SCAN_URL",
  MALWARE_CLAMD_HOST: "MALWARE_CLAMD_HOST",
  MALWARE_CLAMD_PORT: "MALWARE_CLAMD_PORT",
} as const;

export type EnvKey = (typeof EnvKeys)[keyof typeof EnvKeys];

/** Default local development ports. */
export const DefaultPorts = {
  backend: 3000,
  web: 5173,
  postgres: 5432,
  redis: 6379,
  hardhat: 8545,
} as const;

/** Shared HTTP / API constants. */
export const ApiConstants = {
  prefix: "/api/v1",
  healthPath: "/health",
} as const;

/** Object storage provider: Cloudflare R2. */
export const ObjectStorageProvider = "cloudflare_r2" as const;

export const AppName = "TrustChain" as const;

/** Seeded RBAC role keys (Wave 1). */
export const RoleKeys = {
  superAdmin: "super_admin",
  orgAdmin: "org_admin",
  employee: "employee",
  publicUser: "public_user",
} as const;

/** Wave 2 document lifecycle statuses. */
export const DocumentStatuses = {
  pendingUpload: "pending_upload",
  draft: "draft",
  active: "active",
  archived: "archived",
  expired: "expired",
} as const;

/** Wave 2 upload-session statuses. */
export const DocumentUploadSessionStatuses = {
  pending: "pending",
  completed: "completed",
  expired: "expired",
  aborted: "aborted",
} as const;

/** Document share / ACL permission levels. */
export const DocumentPermissions = {
  view: "view",
  download: "download",
  edit: "edit",
  manage: "manage",
} as const;

/** Document access-policy subject types. */
export const DocumentAccessSubjectTypes = {
  user: "user",
  role: "role",
  organization: "organization",
} as const;

/** Allowed MIME types for document uploads (Wave 2). */
export const DocumentAllowedMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/** Max upload size in bytes (25 MiB). */
export const DocumentMaxUploadBytes = 25 * 1024 * 1024;

/** Wave 3 — supported networks only (Hardhat + Sepolia). */
export const BlockchainNetworkKeys = {
  hardhat: "hardhat",
  sepolia: "sepolia",
} as const;

export const BlockchainAllowedNetworks = [
  BlockchainNetworkKeys.hardhat,
  BlockchainNetworkKeys.sepolia,
] as const;

export const BlockchainChainIds = {
  hardhat: 31337,
  sepolia: 11155111,
} as const;

/** Anchor verification / lifecycle statuses. */
export const BlockchainAnchorStatuses = {
  pending: "pending",
  anchored: "anchored",
  revoked: "revoked",
  failed: "failed",
} as const;

export const BlockchainTxStatuses = {
  pending: "pending",
  submitted: "submitted",
  confirming: "confirming",
  confirmed: "confirmed",
  failed: "failed",
  replaced: "replaced",
} as const;

export const BlockchainOperations = {
  registerOrg: "register_org",
  anchor: "anchor",
  revoke: "revoke",
} as const;

export const BlockchainRetryJobStatuses = {
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  dead: "dead",
} as const;

export const OrganizationChainRegistrationStatuses = {
  pending: "pending",
  registered: "registered",
  failed: "failed",
} as const;

/** Wave 4 — verification internal pipeline states. */
export const VerificationInternalStatuses = {
  pending: "pending",
  processing: "processing",
  completed: "completed",
  failed: "failed",
} as const;

/** Wave 4 — external verification outcomes (report result). */
export const VerificationOutcomes = {
  valid: "valid",
  invalid: "invalid",
  revoked: "revoked",
  expired: "expired",
  missing: "missing",
  tampered: "tampered",
} as const;

export const VerificationModes = {
  sync: "sync",
  async: "async",
} as const;

/** Default verification cache TTL (5 minutes). */
export const VerificationCacheTtlMs = 5 * 60 * 1000;

/** Default verify rate limit: 30 requests / 5 minutes per user+org. */
export const VerificationRateLimit = {
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
} as const;

/** Wave 5 — document / link visibility levels. */
export const VerificationVisibility = {
  private: "private",
  organization: "organization",
  public: "public",
  restricted: "restricted",
} as const;

/** Wave 5 — public link/token lifecycle. */
export const PublicVerificationLinkStatuses = {
  active: "active",
  expired: "expired",
  revoked: "revoked",
  disabled: "disabled",
} as const;

export const PublicVerifyLookupTypes = {
  verificationId: "verification_id",
  hash: "hash",
  tx: "tx",
  document: "document",
  link: "link",
  body: "body",
} as const;

/** Canonical public URL path templates (host from PUBLIC_VERIFY_BASE_URL). */
export const PublicVerifyUrlPaths = {
  link: "/link/{token}",
  hash: "/hash/{hash}",
  verify: "/verify/{code}",
  document: "/document/{publicVerifyCode}",
  tx: "/tx/{transactionHash}",
} as const;

/** Public anonymous rate limit. */
export const PublicVerifyRateLimit = {
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
} as const;

/** Abuse protection defaults. */
export const PublicAbuseProtection = {
  strikeThreshold: 5,
  baseBlockMs: 60_000,
  maxBlockMs: 60 * 60 * 1000,
  reputationBlockScore: 10,
} as const;

/** Signed public report TTL (default 24h). */
export const PublicReportTtlMs = 24 * 60 * 60 * 1000;

/** Wave 6 — QR format versions. */
export const QrFormatVersions = {
  /** URL payload — camera-app friendly */
  V1: "V1",
  /** Signed JSON payload */
  V2: "V2",
  /** Offline verification payload (hash + proof metadata, no private data) */
  V3: "V3",
} as const;

export const QrStatuses = {
  active: "active",
  revoked: "revoked",
  expired: "expired",
  rotated: "rotated",
  disabled: "disabled",
} as const;

export const QrIntegrity = {
  signatureVersion: "1",
  algorithm: "HMAC-SHA256",
} as const;

export const QrUrlPaths = {
  scan: "/qr/{token}",
} as const;

export const QrPrintDefaults = {
  pageSize: "A4",
  dpi: 300,
  marginMm: 10,
  bleedMm: 3,
  qrPerPage: 1,
} as const;

/** Wave 7 — browser extension identifiers & states. */
export const ExtensionIdPrefixes = {
  session: "EXT-SESSION",
  cache: "EXT-CACHE",
  event: "EXT-EVENT",
} as const;

export const ExtensionLifecycleStates = {
  active: "active",
  inactive: "inactive",
  scanning: "scanning",
  verifying: "verifying",
  blocked: "blocked",
  failed: "failed",
} as const;

export const ExtensionNetworkStates = {
  online: "online",
  offline: "offline",
  synchronizing: "synchronizing",
} as const;

export const ExtensionRateLimit = {
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
} as const;

/** Wave 8 — mobile identifiers, sync priorities, app states. */
export const MobileIdPrefixes = {
  session: "MOBILE-SESSION",
  cache: "MOBILE-CACHE",
  event: "MOBILE-EVENT",
  device: "MOBILE-DEVICE",
} as const;

export const MobileAppStates = {
  online: "online",
  offline: "offline",
  synchronizing: "synchronizing",
  verifying: "verifying",
  blocked: "blocked",
  failed: "failed",
} as const;

export const MobileSyncPriorities = {
  critical: "critical",
  high: "high",
  normal: "normal",
  low: "low",
  background: "background",
} as const;

export const MobileSyncPriorityOrder = [
  MobileSyncPriorities.critical,
  MobileSyncPriorities.high,
  MobileSyncPriorities.normal,
  MobileSyncPriorities.low,
  MobileSyncPriorities.background,
] as const;

export const MobileRateLimit = {
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
} as const;

/** Wave 9 — AI / OCR platform (advisory only). */
export const AiIdPrefixes = {
  ocrJob: "OCR-JOB",
  aiJob: "AI-JOB",
  embeddingJob: "EMBEDDING-JOB",
  lineage: "LINEAGE",
  /** Phase 2 — gateway / worker ledger (v1 maps Wave 9 jobs → tasks). */
  worker: "AI-WORKER",
  queue: "AI-QUEUE",
  task: "AI-TASK",
  attempt: "AI-ATTEMPT",
  model: "AI-MODEL",
  modelVersion: "MODEL-VERSION",
  artifact: "AI-ARTIFACT",
  evaluation: "AI-EVAL",
  costRecord: "AI-COST",
} as const;

export const AiJobStates = {
  pending: "pending",
  processing: "processing",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  /** Phase 2 worker ledger */
  retrying: "retrying",
  deadLetter: "dead_letter",
} as const;

/** Phase 2 — dedicated capability queues (never a single shared queue). */
export const AiQueueNames = {
  ocr: "ocr",
  classification: "classification",
  extraction: "extraction",
  embedding: "embedding",
  fraud: "fraud",
  evaluation: "evaluation",
} as const;

export const AiQueueDefaults = {
  maxAttempts: 3,
  visibilityTimeoutMs: 120_000,
  leaseTtlMs: 60_000,
  heartbeatIntervalMs: 15_000,
  lockTtlMs: 30_000,
} as const;

export const AiReviewStates = {
  pendingReview: "pending_review",
  approved: "approved",
  rejected: "rejected",
  escalated: "escalated",
} as const;

export const OcrEngines = {
  auto: "auto",
  tesseract: "tesseract",
  easyocr: "easyocr",
  paddleocr: "paddleocr",
  stub: "stub",
} as const;

export const AiModelProviders = {
  openai: "openai",
  gemini: "gemini",
  local: "local",
  stub: "stub",
} as const;

export const AiRateLimit = {
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
} as const;

export const AiEmbeddingDefaults = {
  dimensions: 1536,
  chunkSize: 800,
  chunkOverlap: 100,
} as const;

/** Document envelope encryption key versions (Phase 1). */
export const DocumentEncryption = {
  algorithm: "aes-256-gcm",
  keyVersions: [1, 2, 3] as const,
  envKeyPrefix: "DOCUMENT_KEY_V",
  activeVersionEnv: "DOCUMENT_ACTIVE_KEY_VERSION",
} as const;

export const AuthRateLimit = {
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
} as const;

export const MalwareScanners = {
  mock: "mock",
  http: "http",
  clamav: "clamav",
} as const;

/** Wave 10 — Operational intelligence platform. */
export const OpsIdPrefixes = {
  alert: "ALERT",
  report: "REPORT",
  case: "CASE",
  policy: "POLICY",
  feature: "FEATURE",
  release: "RELEASE",
  deployment: "DEPLOYMENT",
} as const;

export const OpsEntityStates = {
  active: "active",
  inactive: "inactive",
  pending: "pending",
  suspended: "suspended",
  archived: "archived",
} as const;

export const OpsAlertSeverities = {
  info: "info",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
} as const;

export const ComplianceFrameworks = {
  gdpr: "gdpr",
  soc2: "soc2",
  iso27001: "iso27001",
} as const;

export const BillingPlanKeys = {
  free: "free",
  starter: "starter",
  growth: "growth",
  enterprise: "enterprise",
} as const;

export const OpsRateLimit = {
  windowMs: 5 * 60 * 1000,
  maxRequests: 60,
} as const;

export const PlatformScoreDefaults = {
  trustScore: 0.8,
  healthScore: 0.9,
  riskScore: 0.2,
  complianceScore: 0.75,
} as const;
