-- Phase I Step 1 — wallet synchronization

CREATE TABLE IF NOT EXISTS "wallet_links" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "address_normalized" TEXT NOT NULL,
  "label" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
  "chain_hint" TEXT,
  "last_synced_at" TIMESTAMPTZ,
  "verified_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  "metadata_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "wallet_links_org_address_unique_idx"
  ON "wallet_links" ("organization_id", "address_normalized");
CREATE INDEX IF NOT EXISTS "wallet_links_org_user_idx"
  ON "wallet_links" ("organization_id", "user_id");
CREATE INDEX IF NOT EXISTS "wallet_links_org_status_idx"
  ON "wallet_links" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "wallet_challenges" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "wallet_link_id" UUID NOT NULL REFERENCES "wallet_links"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "nonce" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "expected_proof" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "consumed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "wallet_challenges_link_created_idx"
  ON "wallet_challenges" ("wallet_link_id", "created_at");
CREATE INDEX IF NOT EXISTS "wallet_challenges_org_expires_idx"
  ON "wallet_challenges" ("organization_id", "expires_at");

CREATE TABLE IF NOT EXISTS "wallet_sync_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "wallet_link_id" UUID REFERENCES "wallet_links"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "scheduled_for" TIMESTAMPTZ NOT NULL,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "result_json" JSONB,
  "error_message" TEXT,
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "wallet_sync_jobs_org_created_idx"
  ON "wallet_sync_jobs" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "wallet_sync_jobs_org_status_idx"
  ON "wallet_sync_jobs" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "wallet_ownership_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "wallet_link_id" UUID REFERENCES "wallet_links"("id") ON DELETE SET NULL,
  "user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "event_type" TEXT NOT NULL,
  "address" TEXT,
  "summary" TEXT NOT NULL,
  "meta_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "wallet_ownership_events_org_created_idx"
  ON "wallet_ownership_events" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "wallet_ownership_events_link_created_idx"
  ON "wallet_ownership_events" ("wallet_link_id", "created_at");
