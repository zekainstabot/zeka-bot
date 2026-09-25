const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO achievements (
        achievement_key,
        title_key,
        description_key,
        achievement_type,
        condition_type,
        condition_value,
        credit_reward,
        xp_reward,
        pro_days,
        gift_code_id,
        status,
        is_hidden,
        config,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14
      )
      RETURNING *
    `,
    [
      data.achievementKey,
      data.titleKey,
      data.descriptionKey || null,
      data.achievementType || "GENERAL",
      data.conditionType,
      data.conditionValue ?? 1,
      data.creditReward ?? 0,
      data.xpReward ?? 0,
      data.proDays ?? 0,
      data.giftCodeId || null,
      data.status || "ACTIVE",
      data.isHidden ?? false,
      data.config || null,
      data.createdBy || null,
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM achievements
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByKey(achievementKey) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM achievements
      WHERE achievement_key = $1
      LIMIT 1
    `,
    [achievementKey]
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
      FROM achievements
      ORDER BY id ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function updateById(id, updates) {
  const db = getClient();

  const allowedFields = [
    "achievement_key",
    "title_key",
    "description_key",
    "achievement_type",
    "condition_type",
    "condition_value",
    "credit_reward",
    "xp_reward",
    "pro_days",
    "gift_code_id",
    "status",
    "is_hidden",
    "config",
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
      UPDATE achievements
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM achievements
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByKey,
  findAll,
  updateById,
  deleteById,
};
