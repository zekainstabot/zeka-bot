const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO backups (
        backup_type,
        status,
        file_path,
        file_size,
        metadata,
        started_at,
        completed_at,
        error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      data.backupType || "manual",
      data.status || "pending",
      data.filePath || null,
      data.fileSize ?? null,
      data.metadata || null,
      data.startedAt || new Date(),
      data.completedAt || null,
      data.errorMessage || null,
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM backups
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findLatest(limit = 20) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 20, 100)
  );

  const result = await db.query(
    `
      SELECT *
      FROM backups
      ORDER BY started_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function findByStatus(status, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM backups
      WHERE status = $1
      ORDER BY started_at DESC
      LIMIT $2
    `,
    [status, safeLimit]
  );

  return result.rows;
}

async function updateStatus(id, status, data = {}) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE backups
      SET
        status = $2,
        file_path = COALESCE($3, file_path),
        file_size = COALESCE($4, file_size),
        completed_at = COALESCE($5, completed_at),
        error_message = COALESCE($6, error_message),
        metadata = COALESCE($7, metadata)
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      status,
      data.filePath || null,
      data.fileSize ?? null,
      data.completedAt || null,
      data.errorMessage || null,
      data.metadata || null,
    ]
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM backups
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findLatest,
  findByStatus,
  updateStatus,
  deleteById,
};
