-- Phase F Step 5 — developer API quotas

CREATE TABLE IF NOT EXISTS "developer_api_quotas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "limits_json" JSONB NOT NULL,
  "usage_json" JSONB,
  "exhausted_at" TIMESTAMPTZ,
  "updated_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
