-- Phase H Step 3 — multi-region platform

CREATE TABLE IF NOT EXISTS "platform_regions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "endpoint_url" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "latency_weight" INTEGER NOT NULL DEFAULT 100,
  "metadata_json" JSONB,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "platform_regions_status_priority_idx"
  ON "platform_regions" ("status", "priority");

CREATE TABLE IF NOT EXISTS "org_residency_policies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "home_region_code" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'strict',
  "allowed_regions_json" JSONB NOT NULL DEFAULT '[]',
  "locked_classes_json" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "org_routing_policies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "strategy" TEXT NOT NULL DEFAULT 'home',
  "sticky_ttl_seconds" INTEGER NOT NULL DEFAULT 3600,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "org_replication_policies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "mode" TEXT NOT NULL DEFAULT 'async',
  "target_regions_json" JSONB NOT NULL DEFAULT '[]',
  "lag_seconds_max" INTEGER NOT NULL DEFAULT 300,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "org_failover_policies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "mode" TEXT NOT NULL DEFAULT 'manual',
  "primary_region_code" TEXT NOT NULL,
  "standby_regions_json" JSONB NOT NULL DEFAULT '[]',
  "health_fail_threshold" INTEGER NOT NULL DEFAULT 3,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "region_failover_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "from_region_code" TEXT NOT NULL,
  "to_region_code" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "details_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "region_failover_events_org_created_idx"
  ON "region_failover_events" ("organization_id", "created_at");
