-- Phase G Step 4 — compliance evidence management

CREATE TABLE IF NOT EXISTS "compliance_evidence" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "public_code" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "current_version" INTEGER NOT NULL DEFAULT 1,
  "checksum_sha256" TEXT NOT NULL,
  "mime_type" TEXT,
  "file_name" TEXT,
  "size_bytes" INTEGER NOT NULL DEFAULT 0,
  "tags_json" JSONB NOT NULL DEFAULT '[]',
  "frameworks_json" JSONB NOT NULL DEFAULT '[]',
  "metadata_json" JSONB,
  "content_text" TEXT,
  "object_key" TEXT,
  "validation_json" JSONB,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "compliance_evidence_org_created_idx"
  ON "compliance_evidence" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "compliance_evidence_org_status_idx"
  ON "compliance_evidence" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "compliance_evidence_checksum_idx"
  ON "compliance_evidence" ("checksum_sha256");

CREATE TABLE IF NOT EXISTS "compliance_evidence_versions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "evidence_id" UUID NOT NULL REFERENCES "compliance_evidence"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "checksum_sha256" TEXT NOT NULL,
  "mime_type" TEXT,
  "file_name" TEXT,
  "size_bytes" INTEGER NOT NULL DEFAULT 0,
  "content_text" TEXT,
  "object_key" TEXT,
  "metadata_json" JSONB,
  "change_note" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "compliance_evidence_versions_unique" UNIQUE ("evidence_id", "version")
);

CREATE INDEX IF NOT EXISTS "compliance_evidence_versions_evidence_idx"
  ON "compliance_evidence_versions" ("evidence_id");

CREATE TABLE IF NOT EXISTS "compliance_evidence_links" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "evidence_id" UUID NOT NULL REFERENCES "compliance_evidence"("id") ON DELETE CASCADE,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "label" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "compliance_evidence_links_unique" UNIQUE ("evidence_id", "target_type", "target_id")
);

CREATE INDEX IF NOT EXISTS "compliance_evidence_links_target_idx"
  ON "compliance_evidence_links" ("target_type", "target_id");

CREATE TABLE IF NOT EXISTS "compliance_evidence_custody" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "evidence_id" UUID NOT NULL REFERENCES "compliance_evidence"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL,
  "actor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "actor_ip" TEXT,
  "previous_hash" TEXT,
  "integrity_hash" TEXT NOT NULL,
  "details_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "compliance_evidence_custody_evidence_created_idx"
  ON "compliance_evidence_custody" ("evidence_id", "created_at");

CREATE TABLE IF NOT EXISTS "compliance_evidence_exports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS "compliance_evidence_exports_org_created_idx"
  ON "compliance_evidence_exports" ("organization_id", "created_at");
