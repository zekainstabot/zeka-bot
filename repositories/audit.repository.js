const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO audit_logs (
        user_id,
        admin_user_id,
        action,
        target_type,
        target_id,
        status,
        ip_address,
        user_agent,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9
      )
      RETURNING *
    `,
    [
      data.userId || null,
      data.adminUserId || null,
      data.action,
      data.targetType || null,
      data.targetId || null,
      data.status || "SUCCESS",
      data.ipAddress || null,
      data.userAgent || null,
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
      FROM audit_logs
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByUserId(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findByAdminUserId(adminUserId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM audit_logs
      WHERE admin_user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [adminUserId, safeLimit]
  );

  return result.rows;
}

async function findByAction(action, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM audit_logs
      WHERE action = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [action, safeLimit]
  );

  return result.rows;
}

async function findByTarget(targetType, targetId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM audit_logs
      WHERE target_type = $1
        AND target_id = $2
      ORDER BY created_at DESC, id DESC
      LIMIT $3
    `,
    [targetType, targetId, safeLimit]
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
      FROM audit_logs
      WHERE status = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [status, safeLimit]
  );

  return result.rows;
}

module.exports = {
  create,
  findById,
  findByUserId,
  findByAdminUserId,
  findByAction,
  findByTarget,
  findByStatus,
};
