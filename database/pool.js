const { Pool } = require("pg");
const databaseConfig = require("../config/database");

let pool = null;

function createPool() {
  if (pool) {
    return pool;
  }

  if (!databaseConfig.url) {
    throw new Error("DATABASE_URL is not configured");
  }

  pool = new Pool({
    connectionString: databaseConfig.url,

    min: databaseConfig.pool.min,
    max: databaseConfig.pool.max,

    ssl: databaseConfig.ssl
      ? {
          rejectUnauthorized: false,
        }
      : false,
  });

  return pool;
}

function getPool() {
  if (!pool) {
    return createPool();
  }

  return pool;
}

async function query(text, params = []) {
  const db = getPool();

  return db.query(text, params);
}

async function testConnection() {
  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}

module.exports = {
  createPool,
  getPool,
  query,
  testConnection,
  closePool,
};
