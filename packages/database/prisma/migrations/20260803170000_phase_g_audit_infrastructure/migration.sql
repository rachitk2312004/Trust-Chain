-- Phase G Step 2 — centralized immutable audit infrastructure

CREATE TABLE IF NOT EXISTS "platform_audit_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "correlation_id" TEXT NOT NULL,
  "request_id" TEXT,
  "source" TEXT NOT NULL DEFAULT 'platform',
  "action" TEXT NOT NULL,
  "actor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "actor_ip" TEXT,
  "organization_id" UUID REFERENCES "organizations"("id") ON DELETE SET NULL,
  "resource_type" TEXT,
  "resource_id" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT TRUE,
  "meta_json" JSONB,
  "integrity_hash" TEXT NOT NULL,
  "previous_hash" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "platform_audit_events_org_created_at_idx"
  ON "platform_audit_events" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "platform_audit_events_correlation_created_at_idx"
  ON "platform_audit_events" ("correlation_id", "created_at");
CREATE INDEX IF NOT EXISTS "platform_audit_events_actor_created_at_idx"
  ON "platform_audit_events" ("actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "platform_audit_events_resource_idx"
  ON "platform_audit_events" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "platform_audit_events_action_created_at_idx"
  ON "platform_audit_events" ("action", "created_at");
CREATE INDEX IF NOT EXISTS "platform_audit_events_request_id_idx"
  ON "platform_audit_events" ("request_id");

CREATE TABLE IF NOT EXISTS "audit_export_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID REFERENCES "organizations"("id") ON DELETE CASCADE,
  "format" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "filters_json" JSONB NOT NULL,
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "content_text" TEXT,
  "error_message" TEXT,
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "started_at" TIMESTAMPTZ,
  "finished_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "audit_export_jobs_org_created_at_idx"
  ON "audit_export_jobs" ("organization_id", "created_at");
