-- Phase H Step 1 — enterprise identity & access

CREATE TABLE IF NOT EXISTS "enterprise_saml_configs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "entity_id" TEXT NOT NULL,
  "acs_url" TEXT NOT NULL,
  "idp_entity_id" TEXT NOT NULL,
  "idp_sso_url" TEXT NOT NULL,
  "idp_certificate_pem" TEXT NOT NULL,
  "attribute_mapping_json" JSONB NOT NULL DEFAULT '{}',
  "metadata_xml" TEXT,
  "updated_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "enterprise_scim_configs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "base_url" TEXT NOT NULL,
  "bearer_token_hash" TEXT NOT NULL,
  "token_hint" TEXT NOT NULL,
  "user_mapping_json" JSONB NOT NULL DEFAULT '{}',
  "updated_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "enterprise_roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "parent_role_id" UUID REFERENCES "enterprise_roles"("id") ON DELETE SET NULL,
  "permissions_json" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "enterprise_roles_org_key_unique" UNIQUE ("organization_id", "key")
);

CREATE INDEX IF NOT EXISTS "enterprise_roles_org_status_idx"
  ON "enterprise_roles" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "enterprise_abac_policies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "effect" TEXT NOT NULL,
  "rules_json" JSONB NOT NULL,
  "resource_type" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "enterprise_abac_org_status_priority_idx"
  ON "enterprise_abac_policies" ("organization_id", "status", "priority");

CREATE TABLE IF NOT EXISTS "enterprise_delegate_admins" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "delegate_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scope_json" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'active',
  "granted_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "enterprise_delegates_org_user_unique" UNIQUE ("organization_id", "delegate_user_id")
);

CREATE INDEX IF NOT EXISTS "enterprise_delegates_org_status_idx"
  ON "enterprise_delegate_admins" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "enterprise_access_reviews" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "due_at" TIMESTAMPTZ,
  "created_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "enterprise_access_reviews_org_status_idx"
  ON "enterprise_access_reviews" ("organization_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "enterprise_access_review_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "review_id" UUID NOT NULL REFERENCES "enterprise_access_reviews"("id") ON DELETE CASCADE,
  "subject_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role_key" TEXT NOT NULL,
  "decision" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "decided_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "enterprise_access_review_items_review_idx"
  ON "enterprise_access_review_items" ("review_id");
