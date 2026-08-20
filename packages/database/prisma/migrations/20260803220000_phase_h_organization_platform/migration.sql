-- Phase H Step 2 — enterprise organization platform

ALTER TABLE "departments"
  ADD COLUMN IF NOT EXISTS "parent_department_id" UUID REFERENCES "departments"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "business_unit_id" UUID,
  ADD COLUMN IF NOT EXISTS "cost_center_id" UUID,
  ADD COLUMN IF NOT EXISTS "owner_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "policy_json" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS "departments_parent_idx" ON "departments" ("parent_department_id");
CREATE INDEX IF NOT EXISTS "departments_business_unit_idx" ON "departments" ("business_unit_id");

CREATE TABLE IF NOT EXISTS "org_business_units" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "parent_unit_id" UUID REFERENCES "org_business_units"("id") ON DELETE SET NULL,
  "owner_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "policy_json" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "org_business_units_org_key_unique" UNIQUE ("organization_id", "key")
);

CREATE INDEX IF NOT EXISTS "org_business_units_org_status_idx"
  ON "org_business_units" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "org_cost_centers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "business_unit_id" UUID REFERENCES "org_business_units"("id") ON DELETE SET NULL,
  "owner_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "allocation_pct" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "org_cost_centers_org_code_unique" UNIQUE ("organization_id", "code")
);

CREATE INDEX IF NOT EXISTS "org_cost_centers_org_status_idx"
  ON "org_cost_centers" ("organization_id", "status");

-- Add FKs from departments after BUs/cost centers exist
DO $$ BEGIN
  ALTER TABLE "departments"
    ADD CONSTRAINT "departments_business_unit_id_fkey"
    FOREIGN KEY ("business_unit_id") REFERENCES "org_business_units"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "departments"
    ADD CONSTRAINT "departments_cost_center_id_fkey"
    FOREIGN KEY ("cost_center_id") REFERENCES "org_cost_centers"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "org_approval_workflows" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "org_approval_workflows_org_resource_idx"
  ON "org_approval_workflows" ("organization_id", "resource_type", "status");

CREATE TABLE IF NOT EXISTS "org_approval_steps" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id" UUID NOT NULL REFERENCES "org_approval_workflows"("id") ON DELETE CASCADE,
  "step_order" INTEGER NOT NULL,
  "approver_type" TEXT NOT NULL,
  "approver_ref" TEXT NOT NULL,
  "name" TEXT,
  CONSTRAINT "org_approval_steps_workflow_order_unique" UNIQUE ("workflow_id", "step_order")
);

CREATE INDEX IF NOT EXISTS "org_approval_steps_workflow_idx"
  ON "org_approval_steps" ("workflow_id");
