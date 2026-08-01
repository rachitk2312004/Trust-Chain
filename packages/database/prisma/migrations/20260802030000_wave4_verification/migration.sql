-- Wave 4: Verification engine

CREATE TABLE "verification_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "verification_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "document_version_id" UUID,
    "requested_by_user_id" UUID NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'sync',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT,
    "expected_content_hash" TEXT,
    "options" JSONB,
    "intent_nonce" BIGINT,
    "signature" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "outcome" TEXT NOT NULL,
    "version_number" INTEGER,
    "content_hash" TEXT,
    "blockchain_status" TEXT,
    "revocation_status" TEXT,
    "proof_of_integrity" TEXT,
    "proof_timestamp" TIMESTAMPTZ(6),
    "network_name" TEXT,
    "transaction_hash" TEXT,
    "block_number" BIGINT,
    "checks" JSONB,
    "failure_reasons" JSONB,
    "report" JSONB NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_audit_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_caches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cache_key" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "request_id" UUID,
    "result_id" UUID,
    "outcome" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_caches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verification_requests_verification_code_key" ON "verification_requests"("verification_code");
CREATE UNIQUE INDEX "verification_requests_organization_id_idempotency_key_key" ON "verification_requests"("organization_id", "idempotency_key");
CREATE INDEX "verification_requests_organization_id_created_at_idx" ON "verification_requests"("organization_id", "created_at");
CREATE INDEX "verification_requests_document_id_created_at_idx" ON "verification_requests"("document_id", "created_at");
CREATE INDEX "verification_requests_status_idx" ON "verification_requests"("status");
CREATE INDEX "verification_requests_verification_code_idx" ON "verification_requests"("verification_code");

CREATE UNIQUE INDEX "verification_results_request_id_key" ON "verification_results"("request_id");
CREATE INDEX "verification_results_organization_id_verified_at_idx" ON "verification_results"("organization_id", "verified_at");
CREATE INDEX "verification_results_outcome_idx" ON "verification_results"("outcome");

CREATE INDEX "verification_audit_entries_request_id_idx" ON "verification_audit_entries"("request_id");
CREATE INDEX "verification_audit_entries_organization_id_created_at_idx" ON "verification_audit_entries"("organization_id", "created_at");

CREATE UNIQUE INDEX "verification_caches_cache_key_key" ON "verification_caches"("cache_key");
CREATE INDEX "verification_caches_organization_id_document_id_idx" ON "verification_caches"("organization_id", "document_id");
CREATE INDEX "verification_caches_expires_at_idx" ON "verification_caches"("expires_at");

ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "verification_results" ADD CONSTRAINT "verification_results_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_results" ADD CONSTRAINT "verification_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "verification_audit_entries" ADD CONSTRAINT "verification_audit_entries_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_audit_entries" ADD CONSTRAINT "verification_audit_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_audit_entries" ADD CONSTRAINT "verification_audit_entries_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "verification_caches" ADD CONSTRAINT "verification_caches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_caches" ADD CONSTRAINT "verification_caches_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_caches" ADD CONSTRAINT "verification_caches_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "verification_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "verification_caches" ADD CONSTRAINT "verification_caches_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "verification_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;
