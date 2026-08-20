-- Phase H Step 4 — disaster recovery

CREATE TABLE IF NOT EXISTS "recovery_backup_policies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  "rpo_minutes" INTEGER NOT NULL,
  "rto_minutes" INTEGER NOT NULL,
  "retention_days" INTEGER NOT NULL,
  "region_code" TEXT NOT NULL,
  "scopes_json" JSONB NOT NULL DEFAULT '[]',
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "recovery_backup_policies_org_enabled_idx"
  ON "recovery_backup_policies" ("organization_id", "enabled");

CREATE TABLE IF NOT EXISTS "recovery_backup_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "policy_id" UUID REFERENCES "recovery_backup_policies"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "region_code" TEXT NOT NULL,
  "checksum_sha256" TEXT,
  "size_bytes" INTEGER NOT NULL DEFAULT 0,
  "scopes_json" JSONB NOT NULL DEFAULT '[]',
  "snapshot_json" JSONB,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,
  "error_message" TEXT,
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "recovery_backup_jobs_org_created_idx"
  ON "recovery_backup_jobs" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "recovery_backup_jobs_org_status_idx"
  ON "recovery_backup_jobs" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "recovery_restore_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "backup_job_id" UUID NOT NULL REFERENCES "recovery_backup_jobs"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "target_region_code" TEXT NOT NULL,
  "validation_json" JSONB,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "error_message" TEXT,
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "recovery_restore_jobs_org_created_idx"
  ON "recovery_restore_jobs" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "recovery_failback_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "from_region_code" TEXT NOT NULL,
  "to_region_code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reason" TEXT NOT NULL,
  "steps_json" JSONB NOT NULL DEFAULT '[]',
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "error_message" TEXT,
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "recovery_failback_jobs_org_created_idx"
  ON "recovery_failback_jobs" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "recovery_continuity_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "score" DOUBLE PRECISION NOT NULL,
  "summary_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "recovery_continuity_reports_org_created_idx"
  ON "recovery_continuity_reports" ("organization_id", "created_at");
