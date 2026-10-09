
const { getClient } = require("../database/client");

async function getRemainingCooldown(userId, cooldownMs) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT GREATEST(
        0,
        $2::BIGINT -
        EXTRACT(EPOCH FROM (NOW() - last_request_at)) * 1000
      ) AS remaining_ms
      FROM download_request_cooldowns
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId, cooldownMs]
  );

  return Math.ceil(Number(result.rows[0]?.remaining_ms || 0));
}

async function setCooldown(userId) {
  const db = getClient();

  await db.query(
    `
      INSERT INTO download_request_cooldowns (
        user_id,
        last_request_at
      )
      VALUES ($1, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET last_request_at = NOW()
    `,
    [userId]
  );
}

module.exports = {
  getRemainingCooldown,
  setCooldown,
};
