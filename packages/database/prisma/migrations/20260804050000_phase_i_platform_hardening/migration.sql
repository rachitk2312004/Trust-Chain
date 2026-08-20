-- Phase I Step 5 — production hardening / platform ops

CREATE TABLE IF NOT EXISTS "platform_configurations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL UNIQUE,
  "value_json" JSONB NOT NULL,
  "description" TEXT,
  "updated_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "platform_readiness_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "status" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "checks_json" JSONB NOT NULL,
  "blockers_json" JSONB NOT NULL DEFAULT '[]',
  "triggered_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "platform_readiness_reports_created_idx"
  ON "platform_readiness_reports" ("created_at");
CREATE INDEX IF NOT EXISTS "platform_readiness_reports_status_created_idx"
  ON "platform_readiness_reports" ("status", "created_at");

CREATE TABLE IF NOT EXISTS "platform_metric_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scope" TEXT NOT NULL DEFAULT 'global',
  "metrics_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "platform_metric_snapshots_scope_created_idx"
  ON "platform_metric_snapshots" ("scope", "created_at");

CREATE TABLE IF NOT EXISTS "platform_trace_aggregates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "window_key" TEXT NOT NULL,
  "span_count" INTEGER NOT NULL DEFAULT 0,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "p50_latency_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "p95_latency_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "services_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "platform_trace_aggregates_window_created_idx"
  ON "platform_trace_aggregates" ("window_key", "created_at");
