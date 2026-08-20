-- Phase I Step 4 — ecosystem reputation

CREATE TABLE IF NOT EXISTS "reputation_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "label" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "trust_score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "contribution_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fraud_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "overall_score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "signals_json" JSONB NOT NULL DEFAULT '{}',
  "last_scored_at" TIMESTAMPTZ,
  "updated_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "reputation_profiles_org_subject_unique_idx"
  ON "reputation_profiles" ("organization_id", "subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "reputation_profiles_org_overall_idx"
  ON "reputation_profiles" ("organization_id", "overall_score");
CREATE INDEX IF NOT EXISTS "reputation_profiles_org_type_idx"
  ON "reputation_profiles" ("organization_id", "subject_type");
CREATE INDEX IF NOT EXISTS "reputation_profiles_org_status_idx"
  ON "reputation_profiles" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "reputation_history_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "profile_id" UUID NOT NULL REFERENCES "reputation_profiles"("id") ON DELETE CASCADE,
  "trust_score" DOUBLE PRECISION NOT NULL,
  "contribution_score" DOUBLE PRECISION NOT NULL,
  "fraud_score" DOUBLE PRECISION NOT NULL,
  "overall_score" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "meta_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "reputation_history_profile_created_idx"
  ON "reputation_history_events" ("profile_id", "created_at");
CREATE INDEX IF NOT EXISTS "reputation_history_org_created_idx"
  ON "reputation_history_events" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "reputation_alerts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "profile_id" UUID REFERENCES "reputation_profiles"("id") ON DELETE SET NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "alert_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "score_snapshot" DOUBLE PRECISION,
  "resolved_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "reputation_alerts_org_status_idx"
  ON "reputation_alerts" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "reputation_alerts_org_created_idx"
  ON "reputation_alerts" ("organization_id", "created_at");
