-- Phase F Step 3 — public API usage + idempotency

CREATE TABLE IF NOT EXISTS "api_usage_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "api_key_id" UUID REFERENCES "api_keys"("id") ON DELETE SET NULL,
  "service_account_id" UUID REFERENCES "service_accounts"("id") ON DELETE SET NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL,
  "scope" TEXT,
  "request_id" TEXT,
  "duration_ms" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "api_usage_events_org_created_at_idx"
  ON "api_usage_events" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "api_usage_events_key_created_at_idx"
  ON "api_usage_events" ("api_key_id", "created_at");
CREATE INDEX IF NOT EXISTS "api_usage_events_status_idx"
  ON "api_usage_events" ("status_code");

CREATE TABLE IF NOT EXISTS "api_idempotency_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "api_key_id" UUID NOT NULL REFERENCES "api_keys"("id") ON DELETE CASCADE,
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_status" INTEGER NOT NULL,
  "response_body" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_idempotency_unique_idx"
  ON "api_idempotency_records" ("organization_id", "api_key_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "api_idempotency_expires_at_idx"
  ON "api_idempotency_records" ("expires_at");
