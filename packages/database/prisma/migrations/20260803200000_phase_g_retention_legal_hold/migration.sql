-- Phase G Step 5 — records retention & legal holds

CREATE TABLE IF NOT EXISTS "retention_policies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "target_type" TEXT NOT NULL,
  "retention_days" INTEGER NOT NULL,
  "disposition" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "retention_policies_org_target_status_idx"
  ON "retention_policies" ("organization_id", "target_type", "status");
CREATE INDEX IF NOT EXISTS "retention_policies_org_created_idx"
  ON "retention_policies" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "legal_holds" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "scope" TEXT NOT NULL DEFAULT 'all',
  "target_type" TEXT,
  "target_ids_json" JSONB NOT NULL DEFAULT '[]',
  "starts_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ends_at" TIMESTAMPTZ,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "legal_holds_org_status_idx"
  ON "legal_holds" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "legal_holds_org_created_idx"
  ON "legal_holds" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "retention_runs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "dry_run" BOOLEAN NOT NULL DEFAULT FALSE,
  "summary_json" JSONB,
  "error_message" TEXT,
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "started_at" TIMESTAMPTZ,
  "finished_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "retention_runs_org_created_idx"
  ON "retention_runs" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "retention_archives" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "policy_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'archived',
  "expires_at" TIMESTAMPTZ NOT NULL,
  "archived_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "purged_at" TIMESTAMPTZ,
  "snapshot_json" JSONB NOT NULL,
  "integrity_hash" TEXT NOT NULL,
  "previous_hash" TEXT,
  "hold_blocked" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "retention_archives_org_target_unique" UNIQUE ("organization_id", "target_type", "target_id")
);

CREATE INDEX IF NOT EXISTS "retention_archives_org_status_expires_idx"
  ON "retention_archives" ("organization_id", "status", "expires_at");
CREATE INDEX IF NOT EXISTS "retention_archives_org_created_idx"
  ON "retention_archives" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "retention_custody_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "previous_hash" TEXT,
  "integrity_hash" TEXT NOT NULL,
  "details_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "retention_custody_target_created_idx"
  ON "retention_custody_events" ("organization_id", "target_type", "target_id", "created_at");
CREATE INDEX IF NOT EXISTS "retention_custody_org_created_idx"
  ON "retention_custody_events" ("organization_id", "created_at");
