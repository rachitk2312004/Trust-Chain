-- Phase 1 security: encryption metadata, rate-limit buckets, evidence immutability, QR FKs

ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "encrypted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "encryption_algorithm" TEXT;
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "key_version" INTEGER;
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "wrapped_dek" TEXT;
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "iv" TEXT;
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "auth_tag" TEXT;
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "encryption_metadata" JSONB;

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bucket_key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rate_limit_buckets_bucket_key_key" ON "rate_limit_buckets"("bucket_key");
CREATE INDEX IF NOT EXISTS "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets"("expires_at");

-- QR batch job foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qr_batch_jobs_organization_id_fkey'
  ) THEN
    ALTER TABLE "qr_batch_jobs"
      ADD CONSTRAINT "qr_batch_jobs_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'qr_batch_jobs_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE "qr_batch_jobs"
      ADD CONSTRAINT "qr_batch_jobs_created_by_user_id_fkey"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Evidence immutability: block UPDATE and DELETE at the database layer
CREATE OR REPLACE FUNCTION evidence_immutability_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'evidence_immutable: evidence rows cannot be updated or deleted'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS evidence_block_update ON "evidence";
CREATE TRIGGER evidence_block_update
  BEFORE UPDATE ON "evidence"
  FOR EACH ROW
  EXECUTE PROCEDURE evidence_immutability_guard();

DROP TRIGGER IF EXISTS evidence_block_delete ON "evidence";
CREATE TRIGGER evidence_block_delete
  BEFORE DELETE ON "evidence"
  FOR EACH ROW
  EXECUTE PROCEDURE evidence_immutability_guard();
