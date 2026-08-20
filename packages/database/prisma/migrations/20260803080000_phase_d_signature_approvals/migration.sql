-- Phase D Step 4 — multi-party signature approval workflows

CREATE TABLE IF NOT EXISTS "signature_workflows" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "public_id" TEXT NOT NULL UNIQUE,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "signature_id" UUID REFERENCES "signatures"("id") ON DELETE SET NULL,
  "created_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "workflow_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "threshold_count" INTEGER,
  "current_step" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "cancelled_at" TIMESTAMPTZ,
  "cancelled_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "cancel_reason" TEXT,
  "metadata_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "signature_workflows_type_check"
    CHECK ("workflow_type" IN ('sequential', 'parallel', 'threshold')),
  CONSTRAINT "signature_workflows_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled', 'expired'))
);

CREATE INDEX IF NOT EXISTS "signature_workflows_org_created_at_idx"
  ON "signature_workflows" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "signature_workflows_org_status_idx"
  ON "signature_workflows" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "signature_workflows_signature_id_idx"
  ON "signature_workflows" ("signature_id");
CREATE INDEX IF NOT EXISTS "signature_workflows_created_by_id_idx"
  ON "signature_workflows" ("created_by_id");

CREATE TABLE IF NOT EXISTS "signature_approvals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id" UUID NOT NULL REFERENCES "signature_workflows"("id") ON DELETE CASCADE,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "reviewer_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "step_order" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "comment" TEXT,
  "decided_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "signature_approvals_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'skipped', 'expired')),
  CONSTRAINT "signature_approvals_workflow_reviewer_step_key"
    UNIQUE ("workflow_id", "reviewer_id", "step_order")
);

CREATE INDEX IF NOT EXISTS "signature_approvals_workflow_step_idx"
  ON "signature_approvals" ("workflow_id", "step_order");
CREATE INDEX IF NOT EXISTS "signature_approvals_org_status_idx"
  ON "signature_approvals" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "signature_approvals_reviewer_id_idx"
  ON "signature_approvals" ("reviewer_id");

CREATE TABLE IF NOT EXISTS "signature_approval_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id" UUID NOT NULL REFERENCES "signature_workflows"("id") ON DELETE CASCADE,
  "approval_id" UUID REFERENCES "signature_approvals"("id") ON DELETE SET NULL,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "event_type" TEXT NOT NULL,
  "actor_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "payload_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "signature_approval_events_workflow_created_at_idx"
  ON "signature_approval_events" ("workflow_id", "created_at");
CREATE INDEX IF NOT EXISTS "signature_approval_events_org_created_at_idx"
  ON "signature_approval_events" ("organization_id", "created_at");
