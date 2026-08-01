/**
 * Wave 1 — MFA login challenges (ephemeral, Postgres-backed; Redis not used).
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE mfa_login_challenges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX mfa_login_challenges_token_hash_idx ON mfa_login_challenges (token_hash);
    CREATE INDEX mfa_login_challenges_user_id_idx ON mfa_login_challenges (user_id);
  `);
};

/**
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS mfa_login_challenges;`);
};
