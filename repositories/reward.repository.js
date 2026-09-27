const { getClient } = require("../database/client");

function getDb(client = null) {
  return client || getClient();
}

async function findBySource({
  userId,
  sourceType,
  sourceId,
  rewardType,
  client = null,
}) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM rewards
      WHERE user_id = $1
        AND source_type = $2
        AND source_id = $3
        AND reward_type = $4
      ORDER BY id DESC
      LIMIT 1
    `,
    [userId, sourceType, sourceId, rewardType]
  );

  return result.rows[0] || null;
}

async function create(data, client = null) {
  const db = getDb(client);

  if (!data.userId) {
    throw new Error("User ID is required");
  }

  if (!data.rewardId) {
    throw new Error("Reward ID is required");
  }

  if (!data.rewardType) {
    throw new Error("Reward type is required");
  }

  const result = await db.query(
    `
      INSERT INTO rewards (
        user_id,
        reward_id,
        reward_type,
        source_type,
        source_id,
        credit_amount,
        xp_amount,
        pro_days,
        status,
        expires_at,
        claimed_at,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12::JSONB
      )
      RETURNING *
    `,
    [
      data.userId,
      data.rewardId,
      data.rewardType,
      data.sourceType || null,
      data.sourceId || null,
      data.creditAmount ?? 0,
      data.xpAmount ?? 0,
      data.proDays ?? 0,
      data.status || "GRANTED",
      data.expiresAt || null,
      data.claimedAt || null,
      JSON.stringify(data.metadata || {}),
    ]
  );

  return result.rows[0];
}

module.exports = {
  findBySource,
  create,
};
