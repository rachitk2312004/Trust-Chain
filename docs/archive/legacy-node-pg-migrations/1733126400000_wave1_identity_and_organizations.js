/**
 * Wave 1 — Identity and Organization schema.
 * PostgreSQL is the source of truth. Redis is not used by this migration.
 *
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled', 'pending')),
      email_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX users_email_unique_idx
      ON users (LOWER(email))
      WHERE deleted_at IS NULL;
    CREATE INDEX users_email_idx ON users (email);

    CREATE TABLE roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      parent_organization_id UUID REFERENCES organizations (id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX organizations_slug_unique_idx ON organizations (slug);
    CREATE INDEX organizations_slug_idx ON organizations (slug);
    CREATE INDEX organizations_parent_idx ON organizations (parent_organization_id);

    CREATE TABLE devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      name TEXT,
      fingerprint TEXT,
      user_agent TEXT,
      trusted BOOLEAN NOT NULL DEFAULT FALSE,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );

    CREATE INDEX devices_user_id_idx ON devices (user_id);

    CREATE TABLE sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      device_id UUID REFERENCES devices (id) ON DELETE SET NULL,
      refresh_token_hash TEXT NOT NULL,
      ip INET,
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX sessions_refresh_token_hash_idx ON sessions (refresh_token_hash);
    CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

    CREATE TABLE mfa_factors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'totp' CHECK (type IN ('totp')),
      secret_encrypted TEXT NOT NULL,
      verified_at TIMESTAMPTZ,
      disabled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX mfa_factors_user_id_idx ON mfa_factors (user_id);

    CREATE TABLE email_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      purpose TEXT NOT NULL
        CHECK (purpose IN ('email_verify', 'password_reset')),
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX email_tokens_token_hash_idx ON email_tokens (token_hash);
    CREATE INDEX email_tokens_user_id_idx ON email_tokens (user_id);

    CREATE TABLE role_bindings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      role_id UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, role_id, organization_id)
    );

    CREATE INDEX role_bindings_user_id_idx ON role_bindings (user_id);
    CREATE INDEX role_bindings_organization_id_idx ON role_bindings (organization_id);

    CREATE TABLE branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      region TEXT,
      postal_code TEXT,
      country TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX branches_organization_id_idx ON branches (organization_id);

    CREATE TABLE departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
      branch_id UUID REFERENCES branches (id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX departments_organization_id_idx ON departments (organization_id);
    CREATE INDEX departments_branch_id_idx ON departments (branch_id);

    CREATE TABLE memberships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      branch_id UUID REFERENCES branches (id) ON DELETE SET NULL,
      department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled', 'invited')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (organization_id, user_id)
    );

    CREATE INDEX memberships_organization_id_idx ON memberships (organization_id);
    CREATE INDEX memberships_user_id_idx ON memberships (user_id);

    CREATE TABLE invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role_key TEXT NOT NULL
        CHECK (role_key IN ('org_admin', 'employee', 'public_user')),
      token_hash TEXT NOT NULL,
      invited_by UUID REFERENCES users (id) ON DELETE SET NULL,
      branch_id UUID REFERENCES branches (id) ON DELETE SET NULL,
      department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX invitations_email_idx ON invitations (email);
    CREATE INDEX invitations_organization_id_idx ON invitations (organization_id);
    CREATE INDEX invitations_token_hash_idx ON invitations (token_hash);

    CREATE TABLE organization_branding (
      organization_id UUID PRIMARY KEY REFERENCES organizations (id) ON DELETE CASCADE,
      display_name TEXT,
      logo_object_key TEXT,
      primary_color TEXT,
      secondary_color TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE bulk_import_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
      created_by UUID REFERENCES users (id) ON DELETE SET NULL,
      source_object_key TEXT NOT NULL,
      error_report_object_key TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      total_rows INTEGER NOT NULL DEFAULT 0,
      success_rows INTEGER NOT NULL DEFAULT 0,
      failed_rows INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    CREATE INDEX bulk_import_jobs_organization_id_idx ON bulk_import_jobs (organization_id);

    INSERT INTO roles (key, name, description) VALUES
      ('super_admin', 'Super Admin', 'Platform-wide administrator'),
      ('org_admin', 'Organization Admin', 'Administers a single organization'),
      ('employee', 'Employee', 'Organization member with operational access'),
      ('public_user', 'Public User', 'End user with limited access');
  `);
};

/**
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS bulk_import_jobs;
    DROP TABLE IF EXISTS organization_branding;
    DROP TABLE IF EXISTS invitations;
    DROP TABLE IF EXISTS memberships;
    DROP TABLE IF EXISTS departments;
    DROP TABLE IF EXISTS branches;
    DROP TABLE IF EXISTS role_bindings;
    DROP TABLE IF EXISTS email_tokens;
    DROP TABLE IF EXISTS mfa_factors;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS devices;
    DROP TABLE IF EXISTS organizations CASCADE;
    DROP TABLE IF EXISTS roles;
    DROP TABLE IF EXISTS users;
  `);
};
