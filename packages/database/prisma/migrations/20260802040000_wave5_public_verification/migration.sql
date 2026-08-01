-- Wave 5: Public verification layer

ALTER TABLE "documents" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "documents" ADD COLUMN "public_verify_code" TEXT;
CREATE UNIQUE INDEX "documents_public_verify_code_key" ON "documents"("public_verify_code");
CREATE INDEX "documents_visibility_idx" ON "documents"("visibility");
CREATE INDEX "documents_public_verify_code_idx" ON "documents"("public_verify_code");

CREATE TABLE "public_verification_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID,
    "document_version_id" UUID,
    "verification_request_id" UUID,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'link',
    "status" TEXT NOT NULL DEFAULT 'active',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "expires_at" TIMESTAMPTZ(6),
    "max_uses" INTEGER,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "allow_rehash" BOOLEAN NOT NULL DEFAULT false,
    "require_anchor" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "public_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_verification_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "label" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "snapshot_json" JSONB,
    "created_by_user_id" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "public_verification_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_verification_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "document_id" UUID,
    "link_id" UUID,
    "token_id" UUID,
    "verification_code" TEXT,
    "public_verify_code" TEXT,
    "lookup_type" TEXT NOT NULL,
    "lookup_value_hash" TEXT NOT NULL,
    "outcome" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error_code" TEXT,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "public_verification_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_verification_analytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "document_id" UUID,
    "day" DATE NOT NULL,
    "total_lookups" INTEGER NOT NULL DEFAULT 0,
    "valid_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "revoked_count" INTEGER NOT NULL DEFAULT 0,
    "expired_count" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "tampered_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "public_verification_analytics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_abuse_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ip_hash" TEXT NOT NULL,
    "organization_id" UUID,
    "reason" TEXT NOT NULL,
    "strike_count" INTEGER NOT NULL DEFAULT 1,
    "blocked_until" TIMESTAMPTZ(6) NOT NULL,
    "reputation_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "public_abuse_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_verification_tokens_public_code_key" ON "public_verification_tokens"("public_code");
CREATE UNIQUE INDEX "public_verification_tokens_token_hash_key" ON "public_verification_tokens"("token_hash");
CREATE INDEX "public_verification_tokens_organization_id_idx" ON "public_verification_tokens"("organization_id");
CREATE INDEX "public_verification_tokens_status_idx" ON "public_verification_tokens"("status");
CREATE INDEX "public_verification_tokens_expires_at_idx" ON "public_verification_tokens"("expires_at");

CREATE UNIQUE INDEX "public_verification_links_public_code_key" ON "public_verification_links"("public_code");
CREATE INDEX "public_verification_links_organization_id_document_id_idx" ON "public_verification_links"("organization_id", "document_id");
CREATE INDEX "public_verification_links_status_idx" ON "public_verification_links"("status");

CREATE INDEX "public_verification_events_organization_id_created_at_idx" ON "public_verification_events"("organization_id", "created_at");
CREATE INDEX "public_verification_events_lookup_type_created_at_idx" ON "public_verification_events"("lookup_type", "created_at");
CREATE INDEX "public_verification_events_ip_hash_created_at_idx" ON "public_verification_events"("ip_hash", "created_at");

CREATE UNIQUE INDEX "public_verification_analytics_org_doc_day_key" ON "public_verification_analytics"("organization_id", "document_id", "day");

CREATE INDEX "public_abuse_blocks_ip_hash_blocked_until_idx" ON "public_abuse_blocks"("ip_hash", "blocked_until");

ALTER TABLE "public_verification_tokens" ADD CONSTRAINT "public_verification_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_verification_tokens" ADD CONSTRAINT "public_verification_tokens_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_verification_tokens" ADD CONSTRAINT "public_verification_tokens_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_verification_links" ADD CONSTRAINT "public_verification_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_verification_links" ADD CONSTRAINT "public_verification_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_verification_links" ADD CONSTRAINT "public_verification_links_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public_verification_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_verification_links" ADD CONSTRAINT "public_verification_links_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_verification_events" ADD CONSTRAINT "public_verification_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public_verification_events" ADD CONSTRAINT "public_verification_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public_verification_events" ADD CONSTRAINT "public_verification_events_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "public_verification_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public_verification_events" ADD CONSTRAINT "public_verification_events_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public_verification_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public_verification_analytics" ADD CONSTRAINT "public_verification_analytics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_verification_analytics" ADD CONSTRAINT "public_verification_analytics_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public_abuse_blocks" ADD CONSTRAINT "public_abuse_blocks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
