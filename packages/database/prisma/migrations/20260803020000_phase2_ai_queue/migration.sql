-- Phase 2 Step 2: AI queue / worker / task ledger (advisory; Redis remains ephemeral)

CREATE TABLE "ai_queues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "dlq_name" TEXT NOT NULL,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "visibility_timeout_ms" INTEGER NOT NULL DEFAULT 120000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_queues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_workers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID,
    "hostname" TEXT NOT NULL DEFAULT 'unknown',
    "capabilities_json" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lease_expiration" TIMESTAMPTZ(6),
    "heartbeat_timestamp" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_workers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID,
    "queue_id" UUID,
    "queue_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "worker_id" UUID,
    "lease_expiration" TIMESTAMPTZ(6),
    "heartbeat_timestamp" TIMESTAMPTZ(6),
    "timeout_ms" INTEGER NOT NULL DEFAULT 120000,
    "payload_json" JSONB NOT NULL,
    "result_json" JSONB,
    "error" TEXT,
    "legacy_job_public_code" TEXT,
    "model_public_code" TEXT,
    "model_version_public_code" TEXT,
    "artifact_public_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_task_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "task_id" UUID NOT NULL,
    "worker_id" UUID,
    "attempt_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "error" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_task_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_model_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "model_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "meta_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_model_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID,
    "model_id" UUID,
    "capability" TEXT NOT NULL,
    "metrics_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_cost_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID,
    "model_id" UUID,
    "task_public_code" TEXT,
    "token_usage" INTEGER NOT NULL DEFAULT 0,
    "compute_usage_ms" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_cost_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_artifacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID,
    "parent_artifact_id" UUID,
    "kind" TEXT NOT NULL,
    "task_public_code" TEXT,
    "content_hash" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_queues_public_code_key" ON "ai_queues"("public_code");
CREATE UNIQUE INDEX "ai_queues_name_key" ON "ai_queues"("name");
CREATE INDEX "ai_queues_organization_id_idx" ON "ai_queues"("organization_id");

CREATE UNIQUE INDEX "ai_workers_public_code_key" ON "ai_workers"("public_code");
CREATE INDEX "ai_workers_status_idx" ON "ai_workers"("status");
CREATE INDEX "ai_workers_lease_expiration_idx" ON "ai_workers"("lease_expiration");

CREATE UNIQUE INDEX "ai_tasks_public_code_key" ON "ai_tasks"("public_code");
CREATE INDEX "ai_tasks_organization_id_created_at_idx" ON "ai_tasks"("organization_id", "created_at");
CREATE INDEX "ai_tasks_queue_name_status_idx" ON "ai_tasks"("queue_name", "status");
CREATE INDEX "ai_tasks_status_idx" ON "ai_tasks"("status");
CREATE INDEX "ai_tasks_legacy_job_public_code_idx" ON "ai_tasks"("legacy_job_public_code");
CREATE INDEX "ai_tasks_lease_expiration_idx" ON "ai_tasks"("lease_expiration");

CREATE UNIQUE INDEX "ai_task_attempts_public_code_key" ON "ai_task_attempts"("public_code");
CREATE INDEX "ai_task_attempts_task_id_attempt_number_idx" ON "ai_task_attempts"("task_id", "attempt_number");

CREATE UNIQUE INDEX "ai_models_public_code_key" ON "ai_models"("public_code");
CREATE INDEX "ai_models_provider_capability_idx" ON "ai_models"("provider", "capability");

CREATE UNIQUE INDEX "ai_model_versions_public_code_key" ON "ai_model_versions"("public_code");
CREATE UNIQUE INDEX "ai_model_versions_model_id_version_key" ON "ai_model_versions"("model_id", "version");

CREATE UNIQUE INDEX "ai_evaluations_public_code_key" ON "ai_evaluations"("public_code");
CREATE INDEX "ai_evaluations_capability_created_at_idx" ON "ai_evaluations"("capability", "created_at");

CREATE UNIQUE INDEX "ai_cost_records_public_code_key" ON "ai_cost_records"("public_code");
CREATE INDEX "ai_cost_records_organization_id_created_at_idx" ON "ai_cost_records"("organization_id", "created_at");

CREATE UNIQUE INDEX "ai_artifacts_public_code_key" ON "ai_artifacts"("public_code");
CREATE INDEX "ai_artifacts_org_doc_idx" ON "ai_artifacts"("organization_id", "document_id");
CREATE INDEX "ai_artifacts_parent_artifact_id_idx" ON "ai_artifacts"("parent_artifact_id");
CREATE INDEX "ai_artifacts_kind_idx" ON "ai_artifacts"("kind");

ALTER TABLE "ai_queues" ADD CONSTRAINT "ai_queues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_workers" ADD CONSTRAINT "ai_workers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "ai_queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "ai_workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_task_attempts" ADD CONSTRAINT "ai_task_attempts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_task_attempts" ADD CONSTRAINT "ai_task_attempts_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "ai_workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_model_versions" ADD CONSTRAINT "ai_model_versions_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_cost_records" ADD CONSTRAINT "ai_cost_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_cost_records" ADD CONSTRAINT "ai_cost_records_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_parent_artifact_id_fkey" FOREIGN KEY ("parent_artifact_id") REFERENCES "ai_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed dedicated capability queues (+ DLQ name mapping)
INSERT INTO "ai_queues" ("public_code", "name", "dlq_name") VALUES
  ('AI-QUEUE-OCR00001', 'ocr', 'ocr:dead_letter'),
  ('AI-QUEUE-CLS00001', 'classification', 'classification:dead_letter'),
  ('AI-QUEUE-EXT00001', 'extraction', 'extraction:dead_letter'),
  ('AI-QUEUE-EMB00001', 'embedding', 'embedding:dead_letter'),
  ('AI-QUEUE-FRD00001', 'fraud', 'fraud:dead_letter'),
  ('AI-QUEUE-EVL00001', 'evaluation', 'evaluation:dead_letter');
