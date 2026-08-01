-- Wave 10: Operational intelligence platform

CREATE TABLE "ops_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID,
    "created_by_user_id" UUID,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload_json" JSONB,
    "acknowledged_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ops_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID,
    "created_by_user_id" UUID,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "params_json" JSONB,
    "result_json" JSONB,
    "export_object_key" TEXT,
    "generated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ops_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "investigations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "subject_document_id" UUID,
    "lineage_public_code" TEXT,
    "timeline_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "investigations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "investigation_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "meta_json" JSONB,
    "object_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "definition_json" JSONB NOT NULL,
    "auto_enforce" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ops_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "policy_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policy_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "plan_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "autonomous" BOOLEAN NOT NULL DEFAULT false,
    "quota_json" JSONB,
    "period_start" TIMESTAMPTZ(6),
    "period_end" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount_cents" INTEGER NOT NULL,
    "line_items_json" JSONB,
    "settled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meta_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "rollout_percent" INTEGER NOT NULL DEFAULT 0,
    "kill_switch" BOOLEAN NOT NULL DEFAULT false,
    "targeting_json" JSONB,
    "experiments_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "framework" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "meta_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compliance_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "target_code" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ops_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "health_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "checks_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "health_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "trust_score" DOUBLE PRECISION NOT NULL,
    "health_score" DOUBLE PRECISION NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL,
    "compliance_score" DOUBLE PRECISION NOT NULL,
    "components_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deployment_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "release_code" TEXT NOT NULL,
    "public_code" TEXT NOT NULL,
    "organization_id" UUID,
    "created_by_user_id" UUID,
    "environment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "rollback_plan_json" JSONB,
    "meta_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deployment_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recovery_backups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "kind" TEXT NOT NULL DEFAULT 'snapshot',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "location_ref" TEXT,
    "checksum" TEXT,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "meta_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recovery_backups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "capacity_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "storage_bytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "compute_units" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "network_bytes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "forecast_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capacity_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_catalog_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'internal',
    "lineage_json" JSONB,
    "retention_days" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "data_catalog_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_registry_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "service_key" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "endpoint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "dependencies_json" JSONB,
    "health_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_registry_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "secret_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "secret_ref" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "meta_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "secret_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "topic" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "retained_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ops_alerts_public_code_key" ON "ops_alerts"("public_code");
CREATE INDEX "ops_alerts_org_created_at_idx" ON "ops_alerts"("organization_id", "created_at");
CREATE INDEX "ops_alerts_status_idx" ON "ops_alerts"("status");

CREATE UNIQUE INDEX "ops_reports_public_code_key" ON "ops_reports"("public_code");
CREATE INDEX "ops_reports_org_created_at_idx" ON "ops_reports"("organization_id", "created_at");

CREATE UNIQUE INDEX "investigations_public_code_key" ON "investigations"("public_code");
CREATE INDEX "investigations_org_created_at_idx" ON "investigations"("organization_id", "created_at");

CREATE INDEX "evidence_investigation_id_idx" ON "evidence"("investigation_id");

CREATE UNIQUE INDEX "ops_policies_public_code_key" ON "ops_policies"("public_code");
CREATE INDEX "ops_policies_org_status_idx" ON "ops_policies"("organization_id", "status");

CREATE INDEX "policy_approvals_policy_id_idx" ON "policy_approvals"("policy_id");

CREATE INDEX "subscriptions_org_status_idx" ON "subscriptions"("organization_id", "status");

CREATE INDEX "invoices_org_created_at_idx" ON "invoices"("organization_id", "created_at");

CREATE UNIQUE INDEX "usage_metrics_org_key_day_unique" ON "usage_metrics"("organization_id", "metric_key", "day");
CREATE INDEX "usage_metrics_org_day_idx" ON "usage_metrics"("organization_id", "day");

CREATE UNIQUE INDEX "feature_flags_public_code_key" ON "feature_flags"("public_code");
CREATE UNIQUE INDEX "feature_flags_org_key_unique" ON "feature_flags"("organization_id", "key");
CREATE INDEX "feature_flags_key_idx" ON "feature_flags"("key");

CREATE INDEX "compliance_events_org_created_at_idx" ON "compliance_events"("organization_id", "created_at");
CREATE INDEX "ops_audit_events_org_created_at_idx" ON "ops_audit_events"("organization_id", "created_at");
CREATE INDEX "health_snapshots_org_created_at_idx" ON "health_snapshots"("organization_id", "created_at");
CREATE INDEX "platform_scores_org_created_at_idx" ON "platform_scores"("organization_id", "created_at");

CREATE UNIQUE INDEX "deployment_records_public_code_key" ON "deployment_records"("public_code");
CREATE INDEX "deployment_records_org_created_at_idx" ON "deployment_records"("organization_id", "created_at");

CREATE INDEX "recovery_backups_org_created_at_idx" ON "recovery_backups"("organization_id", "created_at");
CREATE INDEX "capacity_snapshots_org_created_at_idx" ON "capacity_snapshots"("organization_id", "created_at");
CREATE INDEX "data_catalog_entries_org_name_idx" ON "data_catalog_entries"("organization_id", "name");

CREATE UNIQUE INDEX "service_registry_org_key_unique" ON "service_registry_entries"("organization_id", "service_key");

CREATE INDEX "secret_audit_events_org_created_at_idx" ON "secret_audit_events"("organization_id", "created_at");
CREATE INDEX "platform_events_topic_created_at_idx" ON "platform_events"("topic", "created_at");
CREATE INDEX "platform_events_org_created_at_idx" ON "platform_events"("organization_id", "created_at");

ALTER TABLE "ops_alerts" ADD CONSTRAINT "ops_alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ops_alerts" ADD CONSTRAINT "ops_alerts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_reports" ADD CONSTRAINT "ops_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ops_reports" ADD CONSTRAINT "ops_reports_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "investigations" ADD CONSTRAINT "investigations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evidence" ADD CONSTRAINT "evidence_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_policies" ADD CONSTRAINT "ops_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ops_policies" ADD CONSTRAINT "ops_policies_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "policy_approvals" ADD CONSTRAINT "policy_approvals_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "ops_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_approvals" ADD CONSTRAINT "policy_approvals_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compliance_events" ADD CONSTRAINT "compliance_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_audit_events" ADD CONSTRAINT "ops_audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "health_snapshots" ADD CONSTRAINT "health_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_scores" ADD CONSTRAINT "platform_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deployment_records" ADD CONSTRAINT "deployment_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deployment_records" ADD CONSTRAINT "deployment_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recovery_backups" ADD CONSTRAINT "recovery_backups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "capacity_snapshots" ADD CONSTRAINT "capacity_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "data_catalog_entries" ADD CONSTRAINT "data_catalog_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_registry_entries" ADD CONSTRAINT "service_registry_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "secret_audit_events" ADD CONSTRAINT "secret_audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
