-- Phase G Step 3 — compliance engine

CREATE TABLE IF NOT EXISTS "compliance_assessments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "framework" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "passed_rules" INTEGER NOT NULL DEFAULT 0,
  "failed_rules" INTEGER NOT NULL DEFAULT 0,
  "total_rules" INTEGER NOT NULL DEFAULT 0,
  "summary_json" JSONB,
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "scheduled" BOOLEAN NOT NULL DEFAULT FALSE,
  "started_at" TIMESTAMPTZ,
  "finished_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "compliance_assessments_org_fw_created_idx"
  ON "compliance_assessments" ("organization_id", "framework", "created_at");
CREATE INDEX IF NOT EXISTS "compliance_assessments_status_created_idx"
  ON "compliance_assessments" ("status", "created_at");

CREATE TABLE IF NOT EXISTS "compliance_rule_results" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "assessment_id" UUID NOT NULL REFERENCES "compliance_assessments"("id") ON DELETE CASCADE,
  "rule_key" TEXT NOT NULL,
  "framework" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "passed" BOOLEAN NOT NULL,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "evidence_json" JSONB,
  "message" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "compliance_rule_results_assessment_idx"
  ON "compliance_rule_results" ("assessment_id");
CREATE INDEX IF NOT EXISTS "compliance_rule_results_rule_key_idx"
  ON "compliance_rule_results" ("rule_key");

CREATE TABLE IF NOT EXISTS "compliance_violations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "assessment_id" UUID REFERENCES "compliance_assessments"("id") ON DELETE SET NULL,
  "framework" TEXT NOT NULL,
  "rule_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "details_json" JSONB,
  "detected_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "remediated_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "compliance_violations_org_status_idx"
  ON "compliance_violations" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "compliance_violations_fw_rule_idx"
  ON "compliance_violations" ("framework", "rule_key");

CREATE TABLE IF NOT EXISTS "compliance_remediations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "violation_id" UUID NOT NULL REFERENCES "compliance_violations"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "owner_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "due_at" TIMESTAMPTZ,
  "notes" TEXT,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "compliance_remediations_org_status_idx"
  ON "compliance_remediations" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "compliance_remediations_violation_idx"
  ON "compliance_remediations" ("violation_id");

CREATE TABLE IF NOT EXISTS "compliance_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "assessment_id" UUID REFERENCES "compliance_assessments"("id") ON DELETE SET NULL,
  "framework" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "report_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "compliance_reports_org_created_idx"
  ON "compliance_reports" ("organization_id", "created_at");
