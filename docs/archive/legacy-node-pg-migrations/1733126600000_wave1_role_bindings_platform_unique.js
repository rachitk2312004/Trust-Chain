/**
 * Wave 1 — unique platform-level role bindings (organization_id IS NULL).
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE UNIQUE INDEX role_bindings_platform_unique_idx
      ON role_bindings (user_id, role_id)
      WHERE organization_id IS NULL;
  `);
};

/**
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS role_bindings_platform_unique_idx;`);
};
