-- Wave 6: QR generation & discovery

CREATE TABLE "qr_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "size_px" INTEGER NOT NULL DEFAULT 512,
    "error_correction" TEXT NOT NULL DEFAULT 'M',
    "foreground_color" TEXT NOT NULL DEFAULT '#000000',
    "background_color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "logo_object_key" TEXT,
    "margin_modules" INTEGER NOT NULL DEFAULT 4,
    "print_page_size" TEXT NOT NULL DEFAULT 'A4',
    "print_dpi" INTEGER NOT NULL DEFAULT 300,
    "print_margin_mm" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "print_bleed_mm" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "qr_per_page" INTEGER NOT NULL DEFAULT 1,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qr_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_qr_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "public_verification_token_id" UUID NOT NULL,
    "public_verification_link_id" UUID,
    "template_id" UUID,
    "format_version" TEXT NOT NULL DEFAULT 'V1',
    "status" TEXT NOT NULL DEFAULT 'active',
    "visibility" TEXT NOT NULL DEFAULT 'restricted',
    "payload_checksum" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "signature_version" TEXT NOT NULL DEFAULT '1',
    "algorithm" TEXT NOT NULL DEFAULT 'HMAC-SHA256',
    "payload_json" JSONB NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "rotated_from_id" UUID,
    "rotated_to_id" UUID,
    "png_object_key" TEXT,
    "svg_object_key" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),
    "rotated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_qr_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "qr_verification_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "document_id" UUID,
    "qr_code_id" UUID,
    "qr_public_code" TEXT,
    "lookup_type" TEXT NOT NULL,
    "outcome" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error_code" TEXT,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qr_verification_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "qr_analytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "document_id" UUID,
    "day" DATE NOT NULL,
    "scan_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "valid_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "revoked_count" INTEGER NOT NULL DEFAULT 0,
    "expired_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qr_analytics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "qr_batch_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "format_version" TEXT NOT NULL DEFAULT 'V1',
    "result_json" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    CONSTRAINT "qr_batch_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "qr_templates_public_code_key" ON "qr_templates"("public_code");
CREATE INDEX "qr_templates_organization_id_idx" ON "qr_templates"("organization_id");

CREATE UNIQUE INDEX "document_qr_codes_public_code_key" ON "document_qr_codes"("public_code");
CREATE INDEX "document_qr_codes_organization_id_created_at_idx" ON "document_qr_codes"("organization_id", "created_at");
CREATE INDEX "document_qr_codes_document_id_status_idx" ON "document_qr_codes"("document_id", "status");
CREATE INDEX "document_qr_codes_status_idx" ON "document_qr_codes"("status");

CREATE INDEX "qr_verification_events_organization_id_created_at_idx" ON "qr_verification_events"("organization_id", "created_at");
CREATE INDEX "qr_verification_events_qr_code_id_idx" ON "qr_verification_events"("qr_code_id");

CREATE UNIQUE INDEX "qr_analytics_org_doc_day_key" ON "qr_analytics"("organization_id", "document_id", "day");
CREATE INDEX "qr_batch_jobs_organization_id_created_at_idx" ON "qr_batch_jobs"("organization_id", "created_at");

ALTER TABLE "qr_templates" ADD CONSTRAINT "qr_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "qr_templates" ADD CONSTRAINT "qr_templates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_qr_codes" ADD CONSTRAINT "document_qr_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_qr_codes" ADD CONSTRAINT "document_qr_codes_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_qr_codes" ADD CONSTRAINT "document_qr_codes_public_verification_token_id_fkey" FOREIGN KEY ("public_verification_token_id") REFERENCES "public_verification_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_qr_codes" ADD CONSTRAINT "document_qr_codes_public_verification_link_id_fkey" FOREIGN KEY ("public_verification_link_id") REFERENCES "public_verification_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_qr_codes" ADD CONSTRAINT "document_qr_codes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "qr_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_qr_codes" ADD CONSTRAINT "document_qr_codes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "qr_verification_events" ADD CONSTRAINT "qr_verification_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "qr_verification_events" ADD CONSTRAINT "qr_verification_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "qr_verification_events" ADD CONSTRAINT "qr_verification_events_qr_code_id_fkey" FOREIGN KEY ("qr_code_id") REFERENCES "document_qr_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "qr_analytics" ADD CONSTRAINT "qr_analytics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "qr_analytics" ADD CONSTRAINT "qr_analytics_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
