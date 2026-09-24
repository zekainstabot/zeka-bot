const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO gift_codes (
        code,
        description,
        credit_amount,
        xp_amount,
        pro_days,
        max_uses,
        used_count,
        per_user_limit,
        starts_at,
        expires_at,
        status,
        created_by,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `,
    [
      data.code,
      data.description || null,
      data.creditAmount ?? 0,
      data.xpAmount ?? 0,
      data.proDays ?? 0,
      data.maxUses ?? null,
      data.usedCount ?? 0,
      data.perUserLimit ?? 1,
      data.startsAt || null,
      data.expiresAt || null,
      data.status || "ACTIVE",
      data.createdBy || null,
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
      FROM gift_codes
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByCode(code) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM gift_codes
      WHERE code = $1
      LIMIT 1
    `,
    [code]
  );

  return result.rows[0] || null;
}

async function findActiveByCode(code) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM gift_codes
      WHERE code = $1
        AND status = 'ACTIVE'
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (max_uses IS NULL OR used_count < max_uses)
      LIMIT 1
    `,
    [code]
  );

  return result.rows[0] || null;
}

async function findAll(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM gift_codes
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function findActive(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM gift_codes
      WHERE status = 'ACTIVE'
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (max_uses IS NULL OR used_count < max_uses)
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function hasUserUsedCode(giftCodeId, userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT 1
      FROM gift_code_usages
      WHERE gift_code_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [giftCodeId, userId]
  );

  return result.rows.length > 0;
}

async function createUsage(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO gift_code_usages (
        gift_code_id,
        user_id,
        reward_id,
        metadata
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [
      data.giftCodeId,
      data.userId,
      data.rewardId || null,
      data.metadata || null,
    ]
  );

  return result.rows[0];
}

async function findUsageByUser(giftCodeId, userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM gift_code_usages
      WHERE gift_code_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [giftCodeId, userId]
  );

  return result.rows[0] || null;
}

async function findUsagesByCode(giftCodeId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM gift_code_usages
      WHERE gift_code_id = $1
      ORDER BY used_at DESC
      LIMIT $2
    `,
    [giftCodeId, safeLimit]
  );

  return result.rows;
}

async function incrementUsage(id) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE gift_codes
      SET
        used_count = used_count + 1,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "code",
    "description",
    "credit_amount",
    "xp_amount",
    "pro_days",
    "max_uses",
    "per_user_limit",
    "starts_at",
    "expires_at",
    "status",
    "created_by",
    "metadata",
  ];

  const entries = Object.entries(updates).filter(([field]) =>
    allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findById(id);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 2}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE gift_codes
      SET
        ${setClause},
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function updateStatus(id, status) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE gift_codes
      SET
        status = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM gift_codes
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByCode,
  findActiveByCode,
  findAll,
  findActive,
  hasUserUsedCode,
  createUsage,
  findUsageByUser,
  findUsagesByCode,
  incrementUsage,
  updateById,
  updateStatus,
  deleteById,
};
