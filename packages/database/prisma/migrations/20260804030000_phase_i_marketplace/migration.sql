-- Phase I Step 3 — connector marketplace

CREATE TABLE IF NOT EXISTS "marketplace_listings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "publisher_org_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "published_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "connector_key" TEXT,
  "auth_mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "latest_version" TEXT,
  "install_count" INTEGER NOT NULL DEFAULT 0,
  "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "review_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_listings_slug_unique_idx"
  ON "marketplace_listings" ("slug");
CREATE INDEX IF NOT EXISTS "marketplace_listings_publisher_status_idx"
  ON "marketplace_listings" ("publisher_org_id", "status");
CREATE INDEX IF NOT EXISTS "marketplace_listings_category_status_idx"
  ON "marketplace_listings" ("category", "status");

CREATE TABLE IF NOT EXISTS "marketplace_listing_versions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "listing_id" UUID NOT NULL REFERENCES "marketplace_listings"("id") ON DELETE CASCADE,
  "version" TEXT NOT NULL,
  "changelog" TEXT,
  "min_platform_version" TEXT NOT NULL,
  "max_platform_version" TEXT,
  "compatibility_json" JSONB NOT NULL DEFAULT '{}',
  "is_latest" BOOLEAN NOT NULL DEFAULT FALSE,
  "published_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_listing_versions_unique_idx"
  ON "marketplace_listing_versions" ("listing_id", "version");
CREATE INDEX IF NOT EXISTS "marketplace_listing_versions_latest_idx"
  ON "marketplace_listing_versions" ("listing_id", "is_latest");

CREATE TABLE IF NOT EXISTS "marketplace_installations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "listing_id" UUID NOT NULL REFERENCES "marketplace_listings"("id") ON DELETE CASCADE,
  "version_id" UUID NOT NULL REFERENCES "marketplace_listing_versions"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "installed_version" TEXT NOT NULL,
  "ecosystem_integration_id" UUID,
  "installed_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "installed_at" TIMESTAMPTZ,
  "uninstalled_at" TIMESTAMPTZ,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_installations_org_listing_unique_idx"
  ON "marketplace_installations" ("organization_id", "listing_id");
CREATE INDEX IF NOT EXISTS "marketplace_installations_org_status_idx"
  ON "marketplace_installations" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "marketplace_reviews" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "listing_id" UUID NOT NULL REFERENCES "marketplace_listings"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rating" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_reviews_listing_user_unique_idx"
  ON "marketplace_reviews" ("listing_id", "user_id");
CREATE INDEX IF NOT EXISTS "marketplace_reviews_listing_created_idx"
  ON "marketplace_reviews" ("listing_id", "created_at");
CREATE INDEX IF NOT EXISTS "marketplace_reviews_org_created_idx"
  ON "marketplace_reviews" ("organization_id", "created_at");
