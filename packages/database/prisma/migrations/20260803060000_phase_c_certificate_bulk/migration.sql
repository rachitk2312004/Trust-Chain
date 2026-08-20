-- Phase C Step 4 — certificate bulk issuance jobs

CREATE TABLE IF NOT EXISTS "certificate_bulk_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "created_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "format" TEXT NOT NULL,
  "rows_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "errors_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "issued_certificate_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "processed_rows" INTEGER NOT NULL DEFAULT 0,
  "success_rows" INTEGER NOT NULL DEFAULT 0,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "skipped_rows" INTEGER NOT NULL DEFAULT 0,
  "rolled_back_count" INTEGER NOT NULL DEFAULT 0,
  "cancel_requested" BOOLEAN NOT NULL DEFAULT FALSE,
  "rollback_on_cancel" BOOLEAN NOT NULL DEFAULT TRUE,
  "default_title" TEXT,
  "default_template_id" UUID,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "certificate_bulk_jobs_status_check"
    CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT "certificate_bulk_jobs_format_check"
    CHECK ("format" IN ('csv', 'json'))
);

CREATE INDEX IF NOT EXISTS "certificate_bulk_jobs_org_created_at_idx"
  ON "certificate_bulk_jobs" ("organization_id", "created_at");

CREATE INDEX IF NOT EXISTS "certificate_bulk_jobs_org_status_idx"
  ON "certificate_bulk_jobs" ("organization_id", "status");
