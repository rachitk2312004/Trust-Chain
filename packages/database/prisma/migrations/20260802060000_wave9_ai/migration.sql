-- Wave 9: AI / OCR platform (advisory only)
-- pgvector extension ready for production vector ops; embeddings also stored as JSON for CI.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "ai_lineages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "steps_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_lineages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID,
    "document_version_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_status" TEXT NOT NULL DEFAULT 'pending_review',
    "lineage_id" UUID,
    "model_provider" TEXT,
    "model_version" TEXT,
    "evaluation_version" TEXT,
    "confidence" DOUBLE PRECISION,
    "confidence_low" DOUBLE PRECISION,
    "confidence_high" DOUBLE PRECISION,
    "token_usage" INTEGER NOT NULL DEFAULT 0,
    "compute_usage_ms" INTEGER NOT NULL DEFAULT 0,
    "storage_usage_bytes" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "result_json" JSONB,
    "explanation_json" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ocr_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "document_version_id" UUID,
    "ai_job_id" UUID,
    "lineage_id" UUID,
    "engine" TEXT NOT NULL DEFAULT 'stub',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_status" TEXT NOT NULL DEFAULT 'pending_review',
    "model_version" TEXT,
    "evaluation_version" TEXT,
    "confidence" DOUBLE PRECISION,
    "confidence_low" DOUBLE PRECISION,
    "confidence_high" DOUBLE PRECISION,
    "token_usage" INTEGER NOT NULL DEFAULT 0,
    "compute_usage_ms" INTEGER NOT NULL DEFAULT 0,
    "storage_usage_bytes" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    CONSTRAINT "ocr_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ocr_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ocr_job_id" UUID NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "language" TEXT,
    "handwriting_likely" BOOLEAN NOT NULL DEFAULT false,
    "layout_json" JSONB,
    "confidence" DOUBLE PRECISION,
    "confidence_low" DOUBLE PRECISION,
    "confidence_high" DOUBLE PRECISION,
    "model_version" TEXT,
    "evaluation_version" TEXT,
    "explanation_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "classification_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "lineage_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_status" TEXT NOT NULL DEFAULT 'pending_review',
    "model_provider" TEXT,
    "model_version" TEXT,
    "evaluation_version" TEXT,
    "confidence" DOUBLE PRECISION,
    "confidence_low" DOUBLE PRECISION,
    "confidence_high" DOUBLE PRECISION,
    "token_usage" INTEGER NOT NULL DEFAULT 0,
    "compute_usage_ms" INTEGER NOT NULL DEFAULT 0,
    "storage_usage_bytes" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    CONSTRAINT "classification_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "classification_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "classification_job_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "scores_json" JSONB,
    "confidence" DOUBLE PRECISION,
    "confidence_low" DOUBLE PRECISION,
    "confidence_high" DOUBLE PRECISION,
    "model_version" TEXT,
    "evaluation_version" TEXT,
    "explanation_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "classification_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "embedding_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "lineage_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_status" TEXT NOT NULL DEFAULT 'pending_review',
    "model_provider" TEXT,
    "model_version" TEXT,
    "evaluation_version" TEXT,
    "confidence" DOUBLE PRECISION,
    "confidence_low" DOUBLE PRECISION,
    "confidence_high" DOUBLE PRECISION,
    "token_usage" INTEGER NOT NULL DEFAULT 0,
    "compute_usage_ms" INTEGER NOT NULL DEFAULT 0,
    "storage_usage_bytes" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    CONSTRAINT "embedding_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_embeddings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "embedding_json" JSONB NOT NULL,
    "model_version" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fraud_analysis_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "lineage_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_status" TEXT NOT NULL DEFAULT 'pending_review',
    "risk_score" DOUBLE PRECISION,
    "signals_json" JSONB,
    "model_provider" TEXT,
    "model_version" TEXT,
    "evaluation_version" TEXT,
    "confidence" DOUBLE PRECISION,
    "confidence_low" DOUBLE PRECISION,
    "confidence_high" DOUBLE PRECISION,
    "token_usage" INTEGER NOT NULL DEFAULT 0,
    "compute_usage_ms" INTEGER NOT NULL DEFAULT 0,
    "storage_usage_bytes" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "explanation_json" JSONB,
    "advisory_only" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    CONSTRAINT "fraud_analysis_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_human_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ai_job_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),
    CONSTRAINT "ai_human_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "actor_user_id" UUID,
    "job_public_code" TEXT,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "input_hash" TEXT,
    "output_hash" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_model_registry_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_fallback" BOOLEAN NOT NULL DEFAULT false,
    "benchmark_json" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_model_registry_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_lineages_public_code_key" ON "ai_lineages"("public_code");
CREATE INDEX "ai_lineages_org_doc_idx" ON "ai_lineages"("organization_id", "document_id");

CREATE UNIQUE INDEX "ai_jobs_public_code_key" ON "ai_jobs"("public_code");
CREATE INDEX "ai_jobs_organization_id_created_at_idx" ON "ai_jobs"("organization_id", "created_at");
CREATE INDEX "ai_jobs_status_idx" ON "ai_jobs"("status");
CREATE INDEX "ai_jobs_public_code_idx" ON "ai_jobs"("public_code");

CREATE UNIQUE INDEX "ocr_jobs_public_code_key" ON "ocr_jobs"("public_code");
CREATE INDEX "ocr_jobs_organization_id_created_at_idx" ON "ocr_jobs"("organization_id", "created_at");
CREATE INDEX "ocr_jobs_status_idx" ON "ocr_jobs"("status");

CREATE UNIQUE INDEX "ocr_results_ocr_job_id_key" ON "ocr_results"("ocr_job_id");

CREATE UNIQUE INDEX "classification_jobs_public_code_key" ON "classification_jobs"("public_code");
CREATE INDEX "classification_jobs_organization_id_created_at_idx" ON "classification_jobs"("organization_id", "created_at");

CREATE UNIQUE INDEX "classification_results_classification_job_id_key" ON "classification_results"("classification_job_id");

CREATE UNIQUE INDEX "embedding_jobs_public_code_key" ON "embedding_jobs"("public_code");
CREATE INDEX "embedding_jobs_organization_id_created_at_idx" ON "embedding_jobs"("organization_id", "created_at");

CREATE INDEX "document_embeddings_org_doc_idx" ON "document_embeddings"("organization_id", "document_id");

CREATE UNIQUE INDEX "fraud_analysis_jobs_public_code_key" ON "fraud_analysis_jobs"("public_code");
CREATE INDEX "fraud_analysis_jobs_organization_id_created_at_idx" ON "fraud_analysis_jobs"("organization_id", "created_at");

CREATE INDEX "ai_human_reviews_ai_job_id_idx" ON "ai_human_reviews"("ai_job_id");

CREATE INDEX "ai_audit_events_organization_id_created_at_idx" ON "ai_audit_events"("organization_id", "created_at");

CREATE UNIQUE INDEX "ai_model_registry_unique" ON "ai_model_registry_entries"("provider", "model_id", "version", "capability");

ALTER TABLE "ai_lineages" ADD CONSTRAINT "ai_lineages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_lineages" ADD CONSTRAINT "ai_lineages_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_lineage_id_fkey" FOREIGN KEY ("lineage_id") REFERENCES "ai_lineages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_lineage_id_fkey" FOREIGN KEY ("lineage_id") REFERENCES "ai_lineages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_ocr_job_id_fkey" FOREIGN KEY ("ocr_job_id") REFERENCES "ocr_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "classification_jobs" ADD CONSTRAINT "classification_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classification_jobs" ADD CONSTRAINT "classification_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classification_jobs" ADD CONSTRAINT "classification_jobs_lineage_id_fkey" FOREIGN KEY ("lineage_id") REFERENCES "ai_lineages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "classification_results" ADD CONSTRAINT "classification_results_classification_job_id_fkey" FOREIGN KEY ("classification_job_id") REFERENCES "classification_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "embedding_jobs" ADD CONSTRAINT "embedding_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "embedding_jobs" ADD CONSTRAINT "embedding_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "embedding_jobs" ADD CONSTRAINT "embedding_jobs_lineage_id_fkey" FOREIGN KEY ("lineage_id") REFERENCES "ai_lineages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fraud_analysis_jobs" ADD CONSTRAINT "fraud_analysis_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fraud_analysis_jobs" ADD CONSTRAINT "fraud_analysis_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fraud_analysis_jobs" ADD CONSTRAINT "fraud_analysis_jobs_lineage_id_fkey" FOREIGN KEY ("lineage_id") REFERENCES "ai_lineages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_human_reviews" ADD CONSTRAINT "ai_human_reviews_ai_job_id_fkey" FOREIGN KEY ("ai_job_id") REFERENCES "ai_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_human_reviews" ADD CONSTRAINT "ai_human_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_audit_events" ADD CONSTRAINT "ai_audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
