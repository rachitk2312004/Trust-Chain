-- Phase I Step 2 — ecosystem integrations

CREATE TABLE IF NOT EXISTS "ecosystem_integrations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "connector_key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "auth_mode" TEXT NOT NULL,
  "sync_interval_minutes" INTEGER NOT NULL DEFAULT 60,
  "sync_mode" TEXT NOT NULL DEFAULT 'incremental',
  "scopes_json" JSONB NOT NULL DEFAULT '[]',
  "config_json" JSONB NOT NULL DEFAULT '{}',
  "last_synced_at" TIMESTAMPTZ,
  "last_error" TEXT,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ecosystem_integrations_org_connector_name_unique_idx"
  ON "ecosystem_integrations" ("organization_id", "connector_key", "name");
CREATE INDEX IF NOT EXISTS "ecosystem_integrations_org_status_idx"
  ON "ecosystem_integrations" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "ecosystem_integrations_org_connector_idx"
  ON "ecosystem_integrations" ("organization_id", "connector_key");

CREATE TABLE IF NOT EXISTS "integration_credentials" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "integration_id" UUID NOT NULL REFERENCES "ecosystem_integrations"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "secret_hash" TEXT NOT NULL,
  "secret_last4" TEXT NOT NULL,
  "secret_cipher" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ,
  "rotated_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "integration_credentials_integration_version_idx"
  ON "integration_credentials" ("integration_id", "version");
CREATE INDEX IF NOT EXISTS "integration_credentials_org_kind_idx"
  ON "integration_credentials" ("organization_id", "kind");

CREATE TABLE IF NOT EXISTS "integration_oauth_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "integration_id" UUID NOT NULL REFERENCES "ecosystem_integrations"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "state" TEXT NOT NULL UNIQUE,
  "code_verifier" TEXT,
  "redirect_uri" TEXT NOT NULL,
  "scopes_json" JSONB NOT NULL DEFAULT '[]',
  "expires_at" TIMESTAMPTZ NOT NULL,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "integration_oauth_sessions_org_created_idx"
  ON "integration_oauth_sessions" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "integration_sync_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "integration_id" UUID NOT NULL REFERENCES "ecosystem_integrations"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "mode" TEXT NOT NULL DEFAULT 'incremental',
  "scheduled_for" TIMESTAMPTZ NOT NULL,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "result_json" JSONB,
  "error_message" TEXT,
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "integration_sync_jobs_org_created_idx"
  ON "integration_sync_jobs" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "integration_sync_jobs_integration_status_idx"
  ON "integration_sync_jobs" ("integration_id", "status");

CREATE TABLE IF NOT EXISTS "integration_event_subscriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "integration_id" UUID NOT NULL REFERENCES "ecosystem_integrations"("id") ON DELETE CASCADE,
  "event_type" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "filter_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "integration_event_subscriptions_unique_idx"
  ON "integration_event_subscriptions" ("integration_id", "event_type");
CREATE INDEX IF NOT EXISTS "integration_event_subscriptions_org_enabled_idx"
  ON "integration_event_subscriptions" ("organization_id", "enabled");

CREATE TABLE IF NOT EXISTS "integration_event_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "integration_id" UUID NOT NULL REFERENCES "ecosystem_integrations"("id") ON DELETE CASCADE,
  "event_type" TEXT NOT NULL,
  "payload_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "integration_event_logs_org_created_idx"
  ON "integration_event_logs" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "integration_event_logs_integration_type_idx"
  ON "integration_event_logs" ("integration_id", "event_type");
