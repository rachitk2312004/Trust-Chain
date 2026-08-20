-- Phase G Step 1 — search index foundation

CREATE TABLE IF NOT EXISTS "search_index_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "organization_id" UUID REFERENCES "organizations"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "status" TEXT,
  "keywords" TEXT NOT NULL,
  "exact_keys" TEXT NOT NULL,
  "created_at_ref" TIMESTAMPTZ NOT NULL,
  "indexed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "meta_json" JSONB,
  CONSTRAINT "search_index_entries_entity_unique" UNIQUE ("entity_type", "entity_id")
);

CREATE INDEX IF NOT EXISTS "search_index_entries_org_type_idx"
  ON "search_index_entries" ("organization_id", "entity_type");
CREATE INDEX IF NOT EXISTS "search_index_entries_created_at_ref_idx"
  ON "search_index_entries" ("created_at_ref");
CREATE INDEX IF NOT EXISTS "search_index_entries_status_idx"
  ON "search_index_entries" ("status");

CREATE TABLE IF NOT EXISTS "search_index_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID REFERENCES "organizations"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "entity_types_json" JSONB NOT NULL,
  "indexed_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "started_at" TIMESTAMPTZ,
  "finished_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "search_index_jobs_org_created_at_idx"
  ON "search_index_jobs" ("organization_id", "created_at");
