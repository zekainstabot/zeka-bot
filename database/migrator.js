const fs = require("fs");
const path = require("path");

const { getPool } = require("./pool");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function getAppliedMigrations(db) {
  const result = await db.query(`
    SELECT filename
    FROM schema_migrations
    ORDER BY filename ASC
  `);

  return new Set(result.rows.map((row) => row.filename));
}

async function runMigrations() {
  const db = getPool();

  await ensureMigrationsTable(db);

  const files = getMigrationFiles();
  const applied = await getAppliedMigrations(db);

  let appliedCount = 0;

  for (const filename of files) {
    if (applied.has(filename)) {
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, "utf8").trim();

    if (!sql) {
      console.warn(`Skipping empty migration: ${filename}`);
      continue;
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      await client.query(sql);

      await client.query(
        `
          INSERT INTO schema_migrations (filename)
          VALUES ($1)
        `,
        [filename]
      );

      await client.query("COMMIT");

      appliedCount += 1;

      console.log(`Migration applied: ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");

      error.message =
        `Migration failed: ${filename}\n` + error.message;

      throw error;
    } finally {
      client.release();
    }
  }

  return {
    total: files.length,
    applied: appliedCount,
  };
}

module.exports = {
  runMigrations,
  getMigrationFiles,
};
