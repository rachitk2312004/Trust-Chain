-- Phase D Step 1 — digital signature foundation

CREATE TABLE IF NOT EXISTS "signatures" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "public_id" TEXT NOT NULL UNIQUE,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "signer_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "document_id" UUID REFERENCES "documents"("id") ON DELETE SET NULL,
  "certificate_id" UUID REFERENCES "certificates"("id") ON DELETE SET NULL,
  "algorithm" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "public_key_pem" TEXT NOT NULL,
  "signature_value" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "integrity_hash" TEXT NOT NULL,
  "signed_at" TIMESTAMPTZ NOT NULL,
  "expires_at" TIMESTAMPTZ,
  "metadata_json" JSONB,
  "revoked_at" TIMESTAMPTZ,
  "revoked_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "revoke_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "signatures_status_check"
    CHECK ("status" IN ('pending', 'active', 'revoked', 'expired')),
  CONSTRAINT "signatures_algorithm_check"
    CHECK ("algorithm" IN ('RSA-SHA256', 'ECDSA-P256-SHA256', 'Ed25519'))
);

CREATE INDEX IF NOT EXISTS "signatures_org_created_at_idx"
  ON "signatures" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "signatures_org_status_idx"
  ON "signatures" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "signatures_document_id_idx"
  ON "signatures" ("document_id");
CREATE INDEX IF NOT EXISTS "signatures_certificate_id_idx"
  ON "signatures" ("certificate_id");
CREATE INDEX IF NOT EXISTS "signatures_signer_id_idx"
  ON "signatures" ("signer_id");

CREATE TABLE IF NOT EXISTS "signature_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signature_id" UUID NOT NULL REFERENCES "signatures"("id") ON DELETE CASCADE,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "event_type" TEXT NOT NULL,
  "actor_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "payload_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "signature_events_signature_created_at_idx"
  ON "signature_events" ("signature_id", "created_at");
CREATE INDEX IF NOT EXISTS "signature_events_org_created_at_idx"
  ON "signature_events" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "signature_artifacts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signature_id" UUID NOT NULL REFERENCES "signatures"("id") ON DELETE CASCADE,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "content_type" TEXT NOT NULL DEFAULT 'text/plain',
  "metadata_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "signature_artifacts_signature_kind_idx"
  ON "signature_artifacts" ("signature_id", "kind");
CREATE INDEX IF NOT EXISTS "signature_artifacts_org_created_at_idx"
  ON "signature_artifacts" ("organization_id", "created_at");
