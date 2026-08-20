-- Phase E Step 2 — tenant administration (quotas + lifecycle)

CREATE TABLE IF NOT EXISTS "tenant_quotas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "limits_json" JSONB NOT NULL,
  "usage_json" JSONB,
  "updated_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "tenant_lifecycle_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "event_type" TEXT NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT,
  "actor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "meta_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "tenant_lifecycle_events_org_created_at_idx"
  ON "tenant_lifecycle_events" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "tenant_lifecycle_events_type_created_at_idx"
  ON "tenant_lifecycle_events" ("event_type", "created_at");
