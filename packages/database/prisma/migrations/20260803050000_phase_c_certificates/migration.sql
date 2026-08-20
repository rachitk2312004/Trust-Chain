-- Phase C Step 1 — certificate foundation

CREATE TABLE IF NOT EXISTS "certificate_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "layout_json" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "certificate_templates_org_code_unique"
  ON "certificate_templates"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "certificate_templates_org_status_idx"
  ON "certificate_templates"("organization_id", "status");

CREATE TABLE IF NOT EXISTS "certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_id" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_id" UUID,
    "document_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recipient_name" TEXT NOT NULL,
    "recipient_email" TEXT,
    "recipient_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issued_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "metadata_json" JSONB,
    "integrity_hash" TEXT NOT NULL,
    "verification_url" TEXT NOT NULL,
    "qr_public_code" TEXT,
    "issued_by_id" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_id" UUID,
    "revoke_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "certificates_public_id_key" ON "certificates"("public_id");
CREATE INDEX IF NOT EXISTS "certificates_org_created_at_idx" ON "certificates"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "certificates_org_status_idx" ON "certificates"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "certificates_document_id_idx" ON "certificates"("document_id");
CREATE INDEX IF NOT EXISTS "certificates_public_id_idx" ON "certificates"("public_id");

CREATE TABLE IF NOT EXISTS "certificate_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "certificate_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_id" UUID,
    "payload_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificate_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "certificate_events_certificate_created_at_idx"
  ON "certificate_events"("certificate_id", "created_at");
CREATE INDEX IF NOT EXISTS "certificate_events_org_created_at_idx"
  ON "certificate_events"("organization_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "certificate_templates"
    ADD CONSTRAINT "certificate_templates_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "certificate_templates"
    ADD CONSTRAINT "certificate_templates_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "certificates"
    ADD CONSTRAINT "certificates_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "certificates"
    ADD CONSTRAINT "certificates_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "certificates"
    ADD CONSTRAINT "certificates_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "certificates"
    ADD CONSTRAINT "certificates_issued_by_id_fkey"
    FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "certificates"
    ADD CONSTRAINT "certificates_revoked_by_id_fkey"
    FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "certificate_events"
    ADD CONSTRAINT "certificate_events_certificate_id_fkey"
    FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "certificate_events"
    ADD CONSTRAINT "certificate_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "certificate_events"
    ADD CONSTRAINT "certificate_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
