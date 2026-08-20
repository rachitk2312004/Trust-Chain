-- Phase H Step 5 — governance

CREATE TABLE IF NOT EXISTS "governance_policies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "framework" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "owner_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "governance_policies_org_key_unique_idx"
  ON "governance_policies" ("organization_id", "key");
CREATE INDEX IF NOT EXISTS "governance_policies_org_framework_idx"
  ON "governance_policies" ("organization_id", "framework");
CREATE INDEX IF NOT EXISTS "governance_policies_org_status_idx"
  ON "governance_policies" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "governance_risks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "framework" TEXT,
  "likelihood" INTEGER NOT NULL,
  "impact" INTEGER NOT NULL,
  "residual_likelihood" INTEGER NOT NULL,
  "residual_impact" INTEGER NOT NULL,
  "inherent_score" INTEGER NOT NULL,
  "residual_score" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "owner_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "control_keys_json" JSONB NOT NULL DEFAULT '[]',
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "governance_risks_org_key_unique_idx"
  ON "governance_risks" ("organization_id", "key");
CREATE INDEX IF NOT EXISTS "governance_risks_org_status_idx"
  ON "governance_risks" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "governance_risks_org_residual_idx"
  ON "governance_risks" ("organization_id", "residual_score");

CREATE TABLE IF NOT EXISTS "governance_control_assessments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "framework" TEXT NOT NULL,
  "control_key" TEXT NOT NULL,
  "control_title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "findings_json" JSONB NOT NULL DEFAULT '{}',
  "assessor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "assessed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "governance_assessments_org_framework_idx"
  ON "governance_control_assessments" ("organization_id", "framework");
CREATE INDEX IF NOT EXISTS "governance_assessments_org_status_idx"
  ON "governance_control_assessments" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "governance_executive_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "score" DOUBLE PRECISION NOT NULL,
  "summary_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "governance_executive_reports_org_created_idx"
  ON "governance_executive_reports" ("organization_id", "created_at");
