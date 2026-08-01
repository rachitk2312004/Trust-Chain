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
  JWT_ACCESS_SECRET: "JWT_ACCESS_SECRET",
  JWT_ACCESS_EXPIRES_IN: "JWT_ACCESS_EXPIRES_IN",
  JWT_REFRESH_EXPIRES_DAYS: "JWT_REFRESH_EXPIRES_DAYS",
  MFA_ENCRYPTION_KEY: "MFA_ENCRYPTION_KEY",
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
