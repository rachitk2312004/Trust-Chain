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
  /** Wave 9 classification job public codes */
  classificationJob: "CLASSIFICATION-JOB",
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
  hipaa: "hipaa",
} as const;

export const ComplianceFrameworkList = Object.values(ComplianceFrameworks);

export type ComplianceFramework =
  (typeof ComplianceFrameworks)[keyof typeof ComplianceFrameworks];

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

/** Phase B — supported notification event types (closed set). */
export const NotificationEventTypes = {
  invitationCreated: "invitation_created",
  invitationAccepted: "invitation_accepted",
  memberAdded: "member_added",
  documentUploaded: "document_uploaded",
  documentVerified: "document_verified",
  documentArchived: "document_archived",
  documentRestored: "document_restored",
  shareCreated: "share_created",
  qrCreated: "qr_created",
  qrRevoked: "qr_revoked",
  verificationCompleted: "verification_completed",
  certificateIssued: "certificate_issued",
  certificateRevoked: "certificate_revoked",
  signatureCreated: "signature_created",
  signatureRevoked: "signature_revoked",
  signatureVerified: "signature_verified",
  signatureWorkflowCreated: "signature_workflow_created",
  signatureWorkflowApproved: "signature_workflow_approved",
  signatureWorkflowRejected: "signature_workflow_rejected",
  signatureWorkflowCancelled: "signature_workflow_cancelled",
  signatureApprovalRequested: "signature_approval_requested",
  tenantCreated: "tenant_created",
  tenantSuspended: "tenant_suspended",
  tenantRestored: "tenant_restored",
  tenantArchived: "tenant_archived",
  tenantTransferred: "tenant_transferred",
  policyCreated: "policy_created",
  policyUpdated: "policy_updated",
  policyDeleted: "policy_deleted",
  policyAssigned: "policy_assigned",
  policyEvaluated: "policy_evaluated",
  policyConflict: "policy_conflict",
} as const;

export const NotificationEventTypeList = Object.values(NotificationEventTypes);

/** Phase C — certificate statuses (closed set). */
export const CertificateStatuses = {
  draft: "draft",
  issued: "issued",
  revoked: "revoked",
  expired: "expired",
} as const;

export const CertificateStatusList = Object.values(CertificateStatuses);

export const CertificateTemplateStatuses = {
  active: "active",
  archived: "archived",
} as const;

export const CertificateEventTypes = {
  created: "created",
  issued: "issued",
  revoked: "revoked",
  verified: "verified",
  updated: "updated",
  templateCreated: "template_created",
  templateUpdated: "template_updated",
  downloaded: "downloaded",
  rendered: "rendered",
  reprocessed: "reprocessed",
} as const;

export const CertificateBulkJobStatuses = {
  pending: "pending",
  processing: "processing",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
} as const;

export const CertificateBulkJobStatusList = Object.values(CertificateBulkJobStatuses);

export const CertificateBulkFormats = {
  csv: "csv",
  json: "json",
} as const;

export const CertificateBulkFormatList = Object.values(CertificateBulkFormats);

/** Phase D — digital signature foundation. */
export const SignatureStatuses = {
  pending: "pending",
  active: "active",
  revoked: "revoked",
  expired: "expired",
} as const;

export const SignatureStatusList = Object.values(SignatureStatuses);

export const SignatureAlgorithms = {
  rsaSha256: "RSA-SHA256",
  ecdsaP256Sha256: "ECDSA-P256-SHA256",
  /** Reserved for future support — not implemented in Step 1. */
  ed25519: "Ed25519",
} as const;

export const SignatureAlgorithmList = Object.values(SignatureAlgorithms);

export const SupportedSignatureAlgorithms = [
  SignatureAlgorithms.rsaSha256,
  SignatureAlgorithms.ecdsaP256Sha256,
] as const;

export const SignatureEventTypes = {
  created: "created",
  verified: "verified",
  revoked: "revoked",
  updated: "updated",
  expired: "expired",
  reprocessed: "reprocessed",
  downloaded: "downloaded",
} as const;

export const SignatureArtifactKinds = {
  canonicalPayload: "canonical_payload",
  detachedSignature: "detached_signature",
  publicKey: "public_key",
  /** Raw detached payload bytes/text (Phase D Step 2). */
  detachedPayload: "detached_payload",
} as const;

/** Phase D Step 2 — signing workflow kinds. */
export const SignatureWorkflowKinds = {
  document: "document",
  certificate: "certificate",
  detached: "detached",
  generic: "generic",
} as const;

export const SignatureWorkflowKindList = Object.values(SignatureWorkflowKinds);

/** Default org-level signing policy (overridable in-memory; no schema yet). */
export const SignaturePolicyDefaults = {
  defaultAlgorithm: SignatureAlgorithms.rsaSha256,
  allowedAlgorithms: [...SupportedSignatureAlgorithms] as string[],
  /** null = no maximum; signatures may omit expiresAt unless requireExpiration. */
  maxExpirationDays: 365 * 5,
  requireExpiration: false,
  defaultExpirationDays: 365,
  allowDetached: true,
  allowDocumentSigning: true,
  allowCertificateSigning: true,
  allowRevokeBySigner: true,
  allowRevokeByAdmin: true,
  /** Document statuses eligible for signing. */
  signableDocumentStatuses: [
    DocumentStatuses.draft,
    DocumentStatuses.active,
  ] as string[],
  /** Certificate statuses eligible for signing. */
  signableCertificateStatuses: [CertificateStatuses.issued] as string[],
} as const;

/** Phase D Step 4 — multi-party approval workflows. */
export const SignatureApprovalWorkflowTypes = {
  sequential: "sequential",
  parallel: "parallel",
  threshold: "threshold",
} as const;

export const SignatureApprovalWorkflowTypeList = Object.values(SignatureApprovalWorkflowTypes);

export const SignatureApprovalWorkflowStatuses = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
  expired: "expired",
} as const;

export const SignatureApprovalWorkflowStatusList = Object.values(SignatureApprovalWorkflowStatuses);

export const SignatureApprovalStatuses = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  skipped: "skipped",
  expired: "expired",
} as const;

export const SignatureApprovalStatusList = Object.values(SignatureApprovalStatuses);

export const SignatureApprovalEventTypes = {
  created: "created",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
  expired: "expired",
  progressed: "progressed",
  completed: "completed",
} as const;

export const SignatureApprovalEventTypeList = Object.values(SignatureApprovalEventTypes);

export const NotificationChannels = {
  inApp: "in_app",
  email: "email",
} as const;

export const NotificationEmailStatuses = {
  pending: "pending",
  sent: "sent",
  delivered: "delivered",
  failed: "failed",
  skipped: "skipped",
} as const;

/** Outbox lifecycle (string column — no schema migration required). */
export const NotificationOutboxStatuses = {
  pending: "pending",
  processing: "processing",
  sent: "sent",
  delivered: "delivered",
  failed: "failed",
  retry: "retry",
  deadLetter: "dead_letter",
  skipped: "skipped",
} as const;

export const NotificationDigestModes = {
  immediate: "immediate",
  daily: "daily",
  weekly: "weekly",
} as const;

export const NotificationDigestModeList = Object.values(NotificationDigestModes);

/** Reserved preference eventType prefix for digest mode (no schema change). */
export const NotificationDigestPreferenceEventType = "_email_digest";

export const NotificationDeliveryDefaults = {
  maxAttempts: 5,
  staleProcessingMs: 5 * 60 * 1000,
  baseBackoffMs: 30_000,
  maxBackoffMs: 60 * 60 * 1000,
  pollIntervalMs: 5_000,
  batchSize: 25,
} as const;

/** Phase B Step 4 — real-time SSE event names. */
export const NotificationStreamEventTypes = {
  notificationCreated: "notification_created",
  notificationRead: "notification_read",
  notificationDeleted: "notification_deleted",
  unreadCountUpdated: "unread_count_updated",
  notificationDelivered: "notification_delivered",
  heartbeat: "heartbeat",
  connected: "connected",
} as const;

export const NotificationStreamDefaults = {
  heartbeatIntervalMs: 15_000,
  staleConnectionMs: 60_000,
  cleanupIntervalMs: 30_000,
  maxReconnectDelayMs: 30_000,
  baseReconnectDelayMs: 1_000,
} as const;

/** Phase E Step 1 — administration platform. */
export const AdminAuditActions = {
  userInspect: "admin.user.inspect",
  userUpdate: "admin.user.update",
  userSuspend: "admin.user.suspend",
  userRestore: "admin.user.restore",
  organizationInspect: "admin.organization.inspect",
  organizationUpdate: "admin.organization.update",
  organizationSuspend: "admin.organization.suspend",
  organizationRestore: "admin.organization.restore",
  organizationDelete: "admin.organization.delete",
  roleAssign: "admin.role.assign",
  roleRevoke: "admin.role.revoke",
  permissionAssign: "admin.permission.assign",
  configurationUpdate: "admin.configuration.update",
  configurationRollback: "admin.configuration.rollback",
  featureFlagCreate: "admin.feature_flag.create",
  featureFlagUpdate: "admin.feature_flag.update",
  tenantCreate: "admin.tenant.create",
  tenantUpdate: "admin.tenant.update",
  tenantInspect: "admin.tenant.inspect",
  tenantSuspend: "admin.tenant.suspend",
  tenantRestore: "admin.tenant.restore",
  tenantArchive: "admin.tenant.archive",
  tenantTransfer: "admin.tenant.transfer",
  tenantQuotaUpdate: "admin.tenant.quota_update",
  healthInspect: "admin.health.inspect",
  systemInspect: "admin.system.inspect",
  policyCreate: "admin.policy.create",
  policyUpdate: "admin.policy.update",
  policyDelete: "admin.policy.delete",
  policyAssign: "admin.policy.assign",
  policyEvaluate: "admin.policy.evaluate",
  analyticsInspect: "admin.analytics.inspect",
  operationsReprocess: "admin.operations.reprocess",
  operationsCleanup: "admin.operations.cleanup",
  retentionCleanup: "admin.retention.cleanup",
} as const;

export const SystemConfigKeys = {
  roleCapabilities: "admin.role_capabilities",
  platformSettings: "admin.platform_settings",
  maintenanceMode: "admin.maintenance_mode",
  defaultTenantQuotas: "admin.default_tenant_quotas",
  retentionPolicy: "admin.retention_policy",
} as const;

export const AdminCapabilities = {
  adminView: "admin.view",
  adminManage: "admin.manage",
  usersView: "admin.users.view",
  usersManage: "admin.users.manage",
  organizationsView: "admin.organizations.view",
  organizationsManage: "admin.organizations.manage",
  tenantsView: "admin.tenants.view",
  tenantsManage: "admin.tenants.manage",
  rolesManage: "admin.roles.manage",
  permissionsManage: "admin.permissions.manage",
  configurationManage: "admin.configuration.manage",
  featureFlagsManage: "admin.feature_flags.manage",
  policiesView: "admin.policies.view",
  policiesManage: "admin.policies.manage",
  analyticsView: "admin.analytics.view",
  operationsManage: "admin.operations.manage",
  auditView: "admin.audit.view",
} as const;

export const AdminCapabilityList = Object.values(AdminCapabilities);

export const FeatureFlagStatuses = {
  active: OpsEntityStates.active,
  inactive: OpsEntityStates.inactive,
  suspended: OpsEntityStates.suspended,
} as const;

/** Phase E Step 2 — tenant (organization) lifecycle. */
export const TenantLifecycleStatuses = {
  active: "active",
  suspended: "suspended",
  archived: "archived",
  transferred: "transferred",
} as const;

export const TenantLifecycleStatusList = Object.values(TenantLifecycleStatuses);

export const TenantLifecycleEventTypes = {
  created: "created",
  updated: "updated",
  suspended: "suspended",
  restored: "restored",
  archived: "archived",
  transferred: "transferred",
  quotaUpdated: "quota_updated",
} as const;

export const TenantQuotaKeys = {
  users: "users",
  organizations: "organizations",
  documents: "documents",
  certificates: "certificates",
  signatures: "signatures",
  storageBytes: "storageBytes",
} as const;

export const DefaultTenantQuotaLimits = {
  users: 50,
  organizations: 10,
  documents: 1_000,
  certificates: 500,
  signatures: 500,
  storageBytes: 5 * 1024 * 1024 * 1024,
} as const;

/** Phase E Step 3 — admin health reporting. */
export const AdminHealthStatuses = {
  ok: "ok",
  degraded: "degraded",
  down: "down",
} as const;

/** Phase E Step 4 — centralized policy engine. */
export const AdminIdPrefixes = {
  policy: "APOLICY",
} as const;

export const AdminPolicyTypes = {
  permission: "permission",
  quota: "quota",
  retention: "retention",
  workflow: "workflow",
  feature: "feature",
  organization: "organization",
} as const;

export const AdminPolicyTypeList = Object.values(AdminPolicyTypes);

export const AdminPolicyStatuses = {
  draft: "draft",
  active: "active",
  disabled: "disabled",
} as const;

export const AdminPolicyStatusList = Object.values(AdminPolicyStatuses);

export const AdminPolicyDecisions = {
  allow: "allow",
  deny: "deny",
  conflict: "conflict",
  notApplicable: "not_applicable",
} as const;

export const AdminPolicyDecisionList = Object.values(AdminPolicyDecisions);

export const AdminPolicyRetentionActions = {
  archive: "archive",
  delete: "delete",
  retain: "retain",
} as const;

export const AdminHealthStatusList = Object.values(AdminHealthStatuses);

/** Phase E Step 5 — admin analytics, retention, and operations. */
export const AdminRetentionDefaults = {
  auditDays: 365,
  policyEventDays: 180,
  lifecycleEventDays: 365,
  configurationAuditDays: 365,
  diagnosticDays: 90,
} as const;

export const AdminOperationTargets = {
  tenants: "tenants",
  policies: "policies",
  configuration: "configuration",
  audit: "audit",
  diagnostics: "diagnostics",
} as const;

export const AdminOperationTargetList = Object.values(AdminOperationTargets);

export const AdminDiagnosticAuditActions = [
  AdminAuditActions.healthInspect,
  AdminAuditActions.systemInspect,
  AdminAuditActions.analyticsInspect,
] as const;

/** Phase F Step 1 — developer platform foundation. */
export const DeveloperIdPrefixes = {
  apiKeyLive: "tc_live",
  apiKeyTest: "tc_test",
  serviceAccount: "SA",
  webhook: "WH",
} as const;

export const ApiKeyStatuses = {
  active: "active",
  revoked: "revoked",
  expired: "expired",
  rotated: "rotated",
} as const;

export const ApiKeyStatusList = Object.values(ApiKeyStatuses);

export const ApiKeyScopes = {
  read: "read",
  write: "write",
  webhooks: "webhooks",
  keys: "keys",
} as const;

export const ApiKeyScopeList = Object.values(ApiKeyScopes);

export const ServiceAccountStatuses = {
  active: "active",
  suspended: "suspended",
  rotated: "rotated",
} as const;

export const ServiceAccountStatusList = Object.values(ServiceAccountStatuses);

export const WebhookEndpointStatuses = {
  active: "active",
  disabled: "disabled",
  failing: "failing",
} as const;

export const WebhookEndpointStatusList = Object.values(WebhookEndpointStatuses);

export const WebhookDeliveryStatuses = {
  pending: "pending",
  success: "success",
  failed: "failed",
  retrying: "retrying",
} as const;

export const WebhookDeliveryStatusList = Object.values(WebhookDeliveryStatuses);

export const DeveloperRateLimits = {
  keyCreatePerOrg: { maxRequests: 30, windowMs: 60_000 },
  webhookCreatePerOrg: { maxRequests: 30, windowMs: 60_000 },
  serviceAccountCreatePerOrg: { maxRequests: 20, windowMs: 60_000 },
  defaultApiKey: { maxRequests: 1_000, windowMs: 60_000 },
} as const;

export const DefaultWebhookRetryPolicy = {
  maxAttempts: 5,
  initialDelayMs: 5_000,
  maxDelayMs: 15 * 60 * 1000,
  backoffMultiplier: 2,
} as const;

export const DeveloperEventTypes = {
  documentCreated: "document.created",
  documentUpdated: "document.updated",
  certificateCreated: "certificate.created",
  certificateRevoked: "certificate.revoked",
  signatureCreated: "signature.created",
  signatureRevoked: "signature.revoked",
  tenantUpdated: "tenant.updated",
} as const;

export type DeveloperEventType =
  (typeof DeveloperEventTypes)[keyof typeof DeveloperEventTypes];

export const DeveloperEventTypeList = Object.values(DeveloperEventTypes);

/** Timestamp tolerance for webhook signature replay protection (seconds). */
export const WebhookSignatureToleranceSeconds = 300;

export const DeveloperSdkMetadata = {
  name: "@trustchain/sdk",
  version: "0.1.0",
  languages: ["typescript", "javascript", "python"],
  packages: {
    typescript: "@trustchain/sdk",
    javascript: "@trustchain/sdk",
    python: "trustchain-sdk",
  },
  docsPath: "/docs/api/phase-f-developer.md",
  openapiPath: "/docs/api/openapi.json",
  authSchemes: ["api_key", "service_account"],
  basePath: "/api/v1",
  publicBasePath: "/api/public/v1",
} as const;

/** Phase F Step 3 — public API scope → capability map. */
export const PublicApiScopeRequirements = {
  "documents.read": [ApiKeyScopes.read],
  "documents.write": [ApiKeyScopes.write],
  "certificates.read": [ApiKeyScopes.read],
  "certificates.write": [ApiKeyScopes.write],
  "signatures.read": [ApiKeyScopes.read],
  "signatures.write": [ApiKeyScopes.write],
  "usage.read": [ApiKeyScopes.read, ApiKeyScopes.keys],
} as const;

export const PublicApiVersion = "v1" as const;

export const ApiIdempotencyTtlMs = 24 * 60 * 60 * 1000;

/** Phase F Step 5 — default per-tenant developer API quotas. */
export const DefaultDeveloperApiQuotaLimits = {
  requestsPerDay: 10_000,
  requestsPerMonth: 200_000,
  maxApiKeys: 50,
  maxWebhooks: 50,
  maxServiceAccounts: 25,
} as const;

/** Anomaly detection thresholds (tunable). */
export const DeveloperAnomalyThresholds = {
  errorRateWarn: 0.15,
  errorRateCritical: 0.35,
  latencyP95WarnMs: 2_000,
  latencyP95CriticalMs: 5_000,
  volumeSpikeMultiplier: 3,
  minSamplesForAnomaly: 20,
} as const;

/** Phase G Step 1 — searchable entity types. */
export const SearchEntityTypes = {
  document: "document",
  certificate: "certificate",
  signature: "signature",
  user: "user",
  organization: "organization",
  auditEvent: "audit_event",
} as const;

export const SearchEntityTypeList = Object.values(SearchEntityTypes);

export type SearchEntityType = (typeof SearchEntityTypes)[keyof typeof SearchEntityTypes];

/** Search foundation defaults. */
export const SearchDefaults = {
  maxCandidates: 500,
  defaultLimit: 25,
  maxLimit: 100,
  suggestionLimit: 10,
  fuzzyMaxDistance: 2,
  minQueryLength: 1,
  maxQueryLength: 200,
} as const;

/** Phase G Step 2 — centralized audit event sources. */
export const AuditEventSources = {
  platform: "platform",
  admin: "admin",
  document: "document",
  verification: "verification",
  developer: "developer",
  certificate: "certificate",
  signature: "signature",
  search: "search",
} as const;

export const AuditEventSourceList = Object.values(AuditEventSources);

export type AuditEventSource = (typeof AuditEventSources)[keyof typeof AuditEventSources];

export const AuditExportFormats = {
  json: "json",
  csv: "csv",
} as const;

export const AuditExportFormatList = Object.values(AuditExportFormats);

export type AuditExportFormat = (typeof AuditExportFormats)[keyof typeof AuditExportFormats];

export const AuditDefaults = {
  defaultLimit: 50,
  maxLimit: 200,
  maxExportRows: 5_000,
  timelineLimit: 200,
} as const;

/** Phase G Step 3 — compliance assessment / remediation statuses. */
export const ComplianceAssessmentStatuses = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
} as const;

export const ComplianceViolationStatuses = {
  open: "open",
  inProgress: "in_progress",
  remediated: "remediated",
  accepted: "accepted",
  waived: "waived",
} as const;

export const ComplianceRemediationStatuses = {
  pending: "pending",
  inProgress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
} as const;

export const ComplianceDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  passThreshold: 0.8,
  warnThreshold: 0.6,
} as const;

/** Phase G Step 4 — compliance evidence management. */
export const EvidenceStatuses = {
  draft: "draft",
  validated: "validated",
  rejected: "rejected",
  archived: "archived",
} as const;

export const EvidenceStatusList = Object.values(EvidenceStatuses);

export const EvidenceLinkTypes = {
  assessment: "assessment",
  violation: "violation",
  remediation: "remediation",
  report: "report",
  document: "document",
  auditEvent: "audit_event",
  control: "control",
} as const;

export const EvidenceLinkTypeList = Object.values(EvidenceLinkTypes);

export const EvidenceCustodyActions = {
  collected: "collected",
  validated: "validated",
  tagged: "tagged",
  linked: "linked",
  versioned: "versioned",
  exported: "exported",
  transferred: "transferred",
  archived: "archived",
} as const;

export const EvidenceDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  maxExportRows: 2_000,
  maxTags: 30,
  maxContentBytes: 5_000_000,
} as const;

/** Phase G Step 5 — records retention & legal holds. */
export const RetentionTargetTypes = {
  document: "document",
  certificate: "certificate",
  signature: "signature",
  auditEvent: "audit_event",
  evidence: "evidence",
  report: "report",
} as const;

export const RetentionTargetTypeList = Object.values(RetentionTargetTypes);

export const RetentionDispositionActions = {
  archive: "archive",
  purge: "purge",
} as const;

export const RetentionDispositionActionList = Object.values(RetentionDispositionActions);

export const RetentionPolicyStatuses = {
  active: "active",
  disabled: "disabled",
} as const;

export const RetentionPolicyStatusList = Object.values(RetentionPolicyStatuses);

export const LegalHoldStatuses = {
  active: "active",
  released: "released",
} as const;

export const LegalHoldStatusList = Object.values(LegalHoldStatuses);

export const RetentionRunStatuses = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
} as const;

export const RetentionRunStatusList = Object.values(RetentionRunStatuses);

export const RetentionArchiveStatuses = {
  archived: "archived",
  purged: "purged",
  holdBlocked: "hold_blocked",
} as const;

export const RetentionCustodyActions = {
  assigned: "assigned",
  expired: "expired",
  archived: "archived",
  purged: "purged",
  holdApplied: "hold_applied",
  holdReleased: "hold_released",
  verified: "verified",
} as const;

export const RetentionDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  defaultRetentionDays: 365,
  minRetentionDays: 1,
  maxRetentionDays: 3650,
  maxRunBatch: 200,
  schedulerIntervalMs: 60_000,
} as const;

/** Phase H Step 1 — enterprise identity & access. */
export const EnterpriseSamlStatuses = {
  draft: "draft",
  active: "active",
  disabled: "disabled",
} as const;

export const EnterpriseSamlStatusList = Object.values(EnterpriseSamlStatuses);

export const EnterpriseScimStatuses = {
  draft: "draft",
  active: "active",
  disabled: "disabled",
} as const;

export const EnterpriseScimStatusList = Object.values(EnterpriseScimStatuses);

export const EnterpriseRoleStatuses = {
  active: "active",
  disabled: "disabled",
} as const;

export const EnterpriseRoleStatusList = Object.values(EnterpriseRoleStatuses);

export const EnterpriseAbacEffects = {
  allow: "allow",
  deny: "deny",
} as const;

export const EnterpriseAbacEffectList = Object.values(EnterpriseAbacEffects);

export const EnterpriseDelegateStatuses = {
  active: "active",
  revoked: "revoked",
} as const;

export const EnterpriseAccessReviewStatuses = {
  open: "open",
  completed: "completed",
  cancelled: "cancelled",
} as const;

export const EnterpriseAccessReviewStatusList = Object.values(EnterpriseAccessReviewStatuses);

export const EnterpriseAccessReviewDecisions = {
  approve: "approve",
  revoke: "revoke",
  pending: "pending",
} as const;

export const EnterpriseDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  maxRoleDepth: 8,
  maxAbacRules: 50,
  scimTokenBytes: 32,
} as const;

/** Phase H Step 2 — enterprise organization structure. */
export const OrgUnitStatuses = {
  active: "active",
  disabled: "disabled",
} as const;

export const OrgUnitStatusList = Object.values(OrgUnitStatuses);

export const OrgApprovalResourceTypes = {
  department: "department",
  businessUnit: "business_unit",
  costCenter: "cost_center",
  document: "document",
  spend: "spend",
} as const;

export const OrgApprovalResourceTypeList = Object.values(OrgApprovalResourceTypes);

export const OrgApproverTypes = {
  owner: "owner",
  role: "role",
  user: "user",
  manager: "manager",
} as const;

export const OrgApproverTypeList = Object.values(OrgApproverTypes);

export const OrgApprovalWorkflowStatuses = {
  active: "active",
  disabled: "disabled",
} as const;

export const OrgPlatformDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  maxHierarchyDepth: 12,
  maxApprovalSteps: 10,
} as const;

/** Phase H Step 3 — multi-region platform. */
export const RegionStatuses = {
  active: "active",
  draining: "draining",
  offline: "offline",
  maintenance: "maintenance",
} as const;

export const RegionStatusList = Object.values(RegionStatuses);

export const ResidencyModes = {
  strict: "strict",
  preferred: "preferred",
  unrestricted: "unrestricted",
} as const;

export const ResidencyModeList = Object.values(ResidencyModes);

export const ReplicationModes = {
  none: "none",
  async: "async",
  sync: "sync",
} as const;

export const ReplicationModeList = Object.values(ReplicationModes);

export const RoutingStrategies = {
  home: "home",
  nearest: "nearest",
  latency: "latency",
  sticky: "sticky",
} as const;

export const RoutingStrategyList = Object.values(RoutingStrategies);

export const FailoverModes = {
  manual: "manual",
  automatic: "automatic",
} as const;

export const FailoverModeList = Object.values(FailoverModes);

export const RegionDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  maxAllowedRegions: 16,
  healthCheckTimeoutMs: 5_000,
} as const;

/** Phase H Step 4 — disaster recovery. */
export const BackupFrequencies = {
  hourly: "hourly",
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
} as const;

export const BackupFrequencyList = Object.values(BackupFrequencies);

export const BackupJobStatuses = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
  expired: "expired",
} as const;

export const BackupJobStatusList = Object.values(BackupJobStatuses);

export const RestoreJobStatuses = {
  pending: "pending",
  validating: "validating",
  restoring: "restoring",
  completed: "completed",
  failed: "failed",
} as const;

export const RestoreJobStatusList = Object.values(RestoreJobStatuses);

export const FailbackStatuses = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
} as const;

export const FailbackStatusList = Object.values(FailbackStatuses);

export const RecoveryDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  defaultRpoMinutes: 60,
  defaultRtoMinutes: 240,
  minRpoMinutes: 5,
  maxRpoMinutes: 10_080,
  minRtoMinutes: 15,
  maxRtoMinutes: 20_160,
  defaultRetentionDays: 30,
} as const;

/** Phase H Step 5 — governance. */
export const GovernanceFrameworks = {
  soc2: "soc2",
  iso27001: "iso27001",
  gdpr: "gdpr",
  hipaa: "hipaa",
  nist: "nist",
  pci_dss: "pci_dss",
} as const;

export const GovernanceFrameworkList = Object.values(GovernanceFrameworks);

export type GovernanceFramework =
  (typeof GovernanceFrameworks)[keyof typeof GovernanceFrameworks];

export const GovernancePolicyStatuses = {
  draft: "draft",
  active: "active",
  retired: "retired",
} as const;

export const GovernancePolicyStatusList = Object.values(GovernancePolicyStatuses);

export const GovernanceRiskStatuses = {
  open: "open",
  mitigating: "mitigating",
  accepted: "accepted",
  closed: "closed",
} as const;

export const GovernanceRiskStatusList = Object.values(GovernanceRiskStatuses);

export const GovernanceAssessmentStatuses = {
  pending: "pending",
  in_progress: "in_progress",
  passed: "passed",
  failed: "failed",
  waived: "waived",
} as const;

export const GovernanceAssessmentStatusList = Object.values(GovernanceAssessmentStatuses);

export const GovernanceDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  minLikelihood: 1,
  maxLikelihood: 5,
  minImpact: 1,
  maxImpact: 5,
} as const;

/** Phase I Step 1 — wallet synchronization. */
export const WalletProviders = {
  metamask: "metamask",
  coinbase: "coinbase",
  walletconnect: "walletconnect",
  phantom: "phantom",
} as const;

export const WalletProviderList = Object.values(WalletProviders);

export type WalletProvider = (typeof WalletProviders)[keyof typeof WalletProviders];

export const WalletLinkStatuses = {
  pending: "pending",
  verified: "verified",
  revoked: "revoked",
  conflict: "conflict",
} as const;

export const WalletLinkStatusList = Object.values(WalletLinkStatuses);

export const WalletSyncJobStatuses = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
} as const;

export const WalletSyncJobStatusList = Object.values(WalletSyncJobStatuses);

export const WalletOwnershipEventTypes = {
  linked: "linked",
  verified: "verified",
  revoked: "revoked",
  conflict_detected: "conflict_detected",
  conflict_resolved: "conflict_resolved",
  synced: "synced",
  primary_set: "primary_set",
} as const;

export const WalletOwnershipEventTypeList = Object.values(WalletOwnershipEventTypes);

export const WalletSyncDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  challengeTtlSeconds: 600,
  maxWalletsPerUser: 10,
  syncIntervalMinutes: 60,
} as const;

/** Phase I Step 2 — ecosystem integrations. */
export const IntegrationConnectorKeys = {
  okta: "okta",
  auth0: "auth0",
  entra: "entra",
  slack: "slack",
  teams: "teams",
  google_drive: "google_drive",
  dropbox: "dropbox",
  jira: "jira",
  asana: "asana",
} as const;

export const IntegrationConnectorKeyList = Object.values(IntegrationConnectorKeys);

export type IntegrationConnectorKey =
  (typeof IntegrationConnectorKeys)[keyof typeof IntegrationConnectorKeys];

export const IntegrationCategories = {
  identity: "identity",
  communication: "communication",
  storage: "storage",
  project: "project",
} as const;

export const IntegrationCategoryList = Object.values(IntegrationCategories);

export const IntegrationAuthModes = {
  oauth: "oauth",
  api_key: "api_key",
} as const;

export const IntegrationAuthModeList = Object.values(IntegrationAuthModes);

export const IntegrationStatuses = {
  draft: "draft",
  connected: "connected",
  error: "error",
  disabled: "disabled",
} as const;

export const IntegrationStatusList = Object.values(IntegrationStatuses);

export const IntegrationSyncJobStatuses = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
} as const;

export const IntegrationSyncJobStatusList = Object.values(IntegrationSyncJobStatuses);

export const IntegrationCredentialKinds = {
  oauth_token: "oauth_token",
  api_key: "api_key",
} as const;

export const IntegrationCredentialKindList = Object.values(IntegrationCredentialKinds);

export const IntegrationDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  oauthStateTtlSeconds: 600,
  defaultSyncIntervalMinutes: 60,
  maxSubscriptionsPerIntegration: 20,
} as const;

/** Phase I Step 3 — connector marketplace. */
export const MarketplaceListingStatuses = {
  draft: "draft",
  published: "published",
  suspended: "suspended",
} as const;

export const MarketplaceListingStatusList = Object.values(MarketplaceListingStatuses);

export const MarketplaceInstallStatuses = {
  pending: "pending",
  installed: "installed",
  failed: "failed",
  uninstalled: "uninstalled",
} as const;

export const MarketplaceInstallStatusList = Object.values(MarketplaceInstallStatuses);

export const MarketplaceDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  minRating: 1,
  maxRating: 5,
  /** Semver-like platform version for compatibility checks */
  platformVersion: "1.3.0",
} as const;

/** Phase I Step 4 — ecosystem reputation. */
export const ReputationSubjectTypes = {
  organization: "organization",
  user: "user",
  certificate: "certificate",
  signature: "signature",
  wallet: "wallet",
  connector: "connector",
} as const;

export const ReputationSubjectTypeList = Object.values(ReputationSubjectTypes);

export type ReputationSubjectType =
  (typeof ReputationSubjectTypes)[keyof typeof ReputationSubjectTypes];

export const ReputationProfileStatuses = {
  active: "active",
  watched: "watched",
  flagged: "flagged",
  suspended: "suspended",
} as const;

export const ReputationProfileStatusList = Object.values(ReputationProfileStatuses);

export const ReputationAlertSeverities = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
} as const;

export const ReputationAlertSeverityList = Object.values(ReputationAlertSeverities);

export const ReputationAlertStatuses = {
  open: "open",
  acknowledged: "acknowledged",
  resolved: "resolved",
  dismissed: "dismissed",
} as const;

export const ReputationAlertStatusList = Object.values(ReputationAlertStatuses);

export const ReputationDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  leaderboardLimit: 25,
  /** Baseline trust when no signals present */
  baselineTrust: 0.5,
  anomalyZThreshold: 2.0,
  fraudFlagThreshold: 0.65,
} as const;

/** Phase I Step 5 — production hardening / platform ops. */
export const PlatformHealthTargets = {
  database: "database",
  redis: "redis",
  objectStorage: "object_storage",
  blockchain: "blockchain",
  notifications: "notifications",
  integrations: "integrations",
} as const;

export const PlatformHealthTargetList = Object.values(PlatformHealthTargets);

export type PlatformHealthTarget =
  (typeof PlatformHealthTargets)[keyof typeof PlatformHealthTargets];

export const PlatformHealthStatuses = {
  ok: "ok",
  degraded: "degraded",
  down: "down",
  unknown: "unknown",
} as const;

export const PlatformHealthStatusList = Object.values(PlatformHealthStatuses);

export type PlatformHealthStatus =
  (typeof PlatformHealthStatuses)[keyof typeof PlatformHealthStatuses];

export const PlatformReadinessStatuses = {
  ready: "ready",
  degraded: "degraded",
  notReady: "not_ready",
} as const;

export const PlatformReadinessStatusList = Object.values(PlatformReadinessStatuses);

export type PlatformReadinessStatus =
  (typeof PlatformReadinessStatuses)[keyof typeof PlatformReadinessStatuses];

export const PlatformConfigKeys = {
  rateLimits: "platform.rate_limits",
  tracing: "platform.tracing",
  maintenance: "platform.maintenance",
  dependencyTimeouts: "platform.dependency_timeouts",
  readinessGates: "platform.readiness_gates",
} as const;

export const PlatformConfigKeyList = Object.values(PlatformConfigKeys);

export const PlatformDefaults = {
  defaultLimit: 50,
  maxLimit: 100,
  probeTimeoutMs: 2500,
  traceSampleLimit: 100,
  /** Default API rate limit window when platform config unset */
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 120,
  /** Minimum critical targets that must be ok for ready */
  criticalTargets: [
    PlatformHealthTargets.database,
  ] as readonly string[],
} as const;
