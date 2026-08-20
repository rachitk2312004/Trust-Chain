-- Phase E Step 1 — administration foundation

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT,
  "target_id" TEXT,
  "organization_id" UUID,
  "success" BOOLEAN NOT NULL DEFAULT TRUE,
  "meta_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_at_idx"
  ON "admin_audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_actor_created_at_idx"
  ON "admin_audit_logs" ("actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_created_at_idx"
  ON "admin_audit_logs" ("action", "created_at");

CREATE TABLE IF NOT EXISTS "system_configurations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL UNIQUE,
  "value_json" JSONB NOT NULL,
  "description" TEXT,
  "updated_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
