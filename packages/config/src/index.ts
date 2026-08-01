/** Environment variable names shared across TrustChain packages. */
export const EnvKeys = {
  NODE_ENV: "NODE_ENV",
  PORT: "PORT",
  DATABASE_URL: "DATABASE_URL",
  CORS_ORIGIN: "CORS_ORIGIN",
  VITE_API_URL: "VITE_API_URL",
  EXPO_PUBLIC_API_URL: "EXPO_PUBLIC_API_URL",
  MINIO_ENDPOINT: "MINIO_ENDPOINT",
  MINIO_PORT: "MINIO_PORT",
  MINIO_ACCESS_KEY: "MINIO_ACCESS_KEY",
  MINIO_SECRET_KEY: "MINIO_SECRET_KEY",
  MINIO_BUCKET: "MINIO_BUCKET",
  MINIO_USE_SSL: "MINIO_USE_SSL",
  SMTP_HOST: "SMTP_HOST",
  SMTP_PORT: "SMTP_PORT",
  CHAIN_RPC_URL: "CHAIN_RPC_URL",
  CHAIN_NETWORK: "CHAIN_NETWORK",
  CHAIN_PRIVATE_KEY: "CHAIN_PRIVATE_KEY",
} as const;

export type EnvKey = (typeof EnvKeys)[keyof typeof EnvKeys];

/** Default local development ports. */
export const DefaultPorts = {
  backend: 3000,
  web: 5173,
  postgres: 5432,
  minioApi: 9000,
  minioConsole: 9001,
  mailhogSmtp: 1025,
  mailhogUi: 8025,
  hardhat: 8545,
} as const;

/** Shared HTTP / API constants. */
export const ApiConstants = {
  prefix: "/api/v1",
  healthPath: "/health",
} as const;

export const AppName = "TrustChain" as const;
