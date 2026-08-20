-- Phase E Step 4 — centralized policy engine

CREATE TABLE IF NOT EXISTS "policy_definitions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "public_code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "policy_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "parent_policy_id" UUID REFERENCES "policy_definitions"("id") ON DELETE SET NULL,
  "rules_json" JSONB NOT NULL,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "policy_definitions_type_status_idx"
  ON "policy_definitions" ("policy_type", "status");
CREATE INDEX IF NOT EXISTS "policy_definitions_parent_idx"
  ON "policy_definitions" ("parent_policy_id");
CREATE INDEX IF NOT EXISTS "policy_definitions_created_at_idx"
  ON "policy_definitions" ("created_at");

CREATE TABLE IF NOT EXISTS "policy_assignments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "policy_id" UUID NOT NULL REFERENCES "policy_definitions"("id") ON DELETE CASCADE,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "inherit_to_children" BOOLEAN NOT NULL DEFAULT TRUE,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "policy_assignments_policy_org_unique_idx" UNIQUE ("policy_id", "organization_id")
);

CREATE INDEX IF NOT EXISTS "policy_assignments_org_idx"
  ON "policy_assignments" ("organization_id");

CREATE TABLE IF NOT EXISTS "policy_evaluation_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "policy_id" UUID REFERENCES "policy_definitions"("id") ON DELETE SET NULL,
  "organization_id" UUID REFERENCES "organizations"("id") ON DELETE SET NULL,
  "actor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "policy_type" TEXT,
  "decision" TEXT NOT NULL,
  "context_json" JSONB,
  "result_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "policy_evaluation_events_org_created_at_idx"
  ON "policy_evaluation_events" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "policy_evaluation_events_type_created_at_idx"
  ON "policy_evaluation_events" ("policy_type", "created_at");
CREATE INDEX IF NOT EXISTS "policy_evaluation_events_decision_created_at_idx"
  ON "policy_evaluation_events" ("decision", "created_at");
