-- Phase F Step 1 — developer platform foundation

CREATE TABLE IF NOT EXISTS "service_accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "public_code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "secret_hash" TEXT,
  "secret_prefix" TEXT,
  "last_rotated_at" TIMESTAMPTZ,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "service_accounts_org_status_idx"
  ON "service_accounts" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "service_accounts_created_at_idx"
  ON "service_accounts" ("created_at");

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "service_account_id" UUID REFERENCES "service_accounts"("id") ON DELETE SET NULL,
  "public_code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "key_prefix" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "scopes_json" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "expires_at" TIMESTAMPTZ,
  "last_used_at" TIMESTAMPTZ,
  "rotated_from_id" UUID REFERENCES "api_keys"("id") ON DELETE SET NULL,
  "revoked_at" TIMESTAMPTZ,
  "rate_limit_json" JSONB,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "api_keys_org_status_idx"
  ON "api_keys" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx"
  ON "api_keys" ("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_key_prefix_idx"
  ON "api_keys" ("key_prefix");
CREATE INDEX IF NOT EXISTS "api_keys_created_at_idx"
  ON "api_keys" ("created_at");

CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "public_code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secret_hash" TEXT NOT NULL,
  "secret_prefix" TEXT NOT NULL,
  "events_json" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "retry_policy_json" JSONB NOT NULL,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "last_delivered_at" TIMESTAMPTZ,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "webhook_endpoints_org_status_idx"
  ON "webhook_endpoints" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "webhook_endpoints_created_at_idx"
  ON "webhook_endpoints" ("created_at");

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "webhook_endpoint_id" UUID NOT NULL REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "event_type" TEXT NOT NULL,
  "payload_json" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_retry_at" TIMESTAMPTZ,
  "response_status" INTEGER,
  "response_body" TEXT,
  "error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "webhook_deliveries_endpoint_created_at_idx"
  ON "webhook_deliveries" ("webhook_endpoint_id", "created_at");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_org_created_at_idx"
  ON "webhook_deliveries" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_retry_idx"
  ON "webhook_deliveries" ("status", "next_retry_at");
