const crypto = require("crypto");
const { getClient } = require("../database/client");

function generateBackupId() {
  return `backup_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO backups (
        backup_id,
        backup_type,
        provider,
        storage_path,
        status,
        started_at,
        completed_at,
        size_bytes,
        checksum,
        encrypted,
        encryption_key_reference,
        initiated_by,
        error_message,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING *
    `,
    [
      data.backupId || generateBackupId(),
      data.backupType || "DATABASE",
      data.provider || null,
      data.storagePath || null,
      data.status || "RUNNING",
      data.startedAt || new Date(),
      data.completedAt || null,
      data.sizeBytes ?? null,
      data.checksum || null,
      data.encrypted ?? true,
      data.encryptionKeyReference || null,
      data.initiatedBy || null,
      data.errorMessage || null,
      data.metadata || null,
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

async function findByBackupId(backupId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM backups
      WHERE backup_id = $1
      LIMIT 1
    `,
    [backupId]
  );

  return result.rows[0] || null;
}

async function findLatest(limit = 10) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 10, 100)
  );

  const result = await db.query(
    `
      SELECT *
      FROM backups
      ORDER BY created_at DESC, id DESC
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
      ORDER BY created_at DESC, id DESC
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
        storage_path = COALESCE($3, storage_path),
        size_bytes = COALESCE($4, size_bytes),
        checksum = COALESCE($5, checksum),
        encrypted = COALESCE($6, encrypted),
        encryption_key_reference = COALESCE(
          $7,
          encryption_key_reference
        ),
        completed_at = COALESCE($8, completed_at),
        error_message = COALESCE($9, error_message),
        metadata = COALESCE($10, metadata)
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      status,
      data.storagePath ?? null,
      data.sizeBytes ?? null,
      data.checksum ?? null,
      data.encrypted ?? null,
      data.encryptionKeyReference ?? null,
      data.completedAt ?? null,
      data.errorMessage ?? null,
      data.metadata ?? null,
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
  findByBackupId,
  findLatest,
  findByStatus,
  updateStatus,
  deleteById,
};
