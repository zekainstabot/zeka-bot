const { getClient } = require("../database/client");

async function findUserByTelegramId(telegramUserId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        id,
        telegram_user_id,
        username,
        display_name,
        is_pro,
        pro_expires_at
      FROM users
      WHERE telegram_user_id = $1
      LIMIT 1
    `,
    [String(telegramUserId)]
  );

  return result.rows[0] || null;
}

async function getActiveSubscriptionByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM pro_subscriptions
      WHERE user_id = $1
        AND status = 'ACTIVE'
        AND expires_at > NOW()
      ORDER BY expires_at DESC
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function getLatestSubscriptionByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM pro_subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function createSubscription({
  userId,
  subscriptionId,
  planType,
  durationMonths,
  startsAt,
  expiresAt,
  sourceType = "ADMIN",
  sourceId = null,
  price = 0,
  currency = "IRT",
  metadata = {},
}) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO pro_subscriptions (
        user_id,
        subscription_id,
        plan_type,
        duration_months,
        status,
        starts_at,
        expires_at,
        source_type,
        source_id,
        price,
        currency,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'ACTIVE',
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11
      )
      RETURNING *
    `,
    [
      userId,
      subscriptionId,
      planType,
      durationMonths,
      startsAt,
      expiresAt,
      sourceType,
      sourceId,
      price,
      currency,
      metadata,
    ]
  );

  return result.rows[0] || null;
}

async function setUserPro({
  userId,
  isPro,
  proExpiresAt,
}) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE users
      SET
        is_pro = $2,
        pro_expires_at = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      userId,
      isPro,
      proExpiresAt,
    ]
  );

  return result.rows[0] || null;
}

async function setSubscriptionStatus({
  subscriptionId,
  status,
}) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE pro_subscriptions
      SET
        status = $2,
        cancelled_at = CASE
          WHEN $2 = 'CANCELLED'
            THEN NOW()
          ELSE cancelled_at
        END,
        updated_at = NOW()
      WHERE subscription_id = $1
      RETURNING *
    `,
    [
      subscriptionId,
      status,
    ]
  );

  return result.rows[0] || null;
}

async function getUserProStatus(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        u.id,
        u.telegram_user_id,
        u.username,
        u.display_name,
        u.is_pro,
        u.pro_expires_at,

        ps.id AS subscription_db_id,
        ps.subscription_id,
        ps.plan_type,
        ps.duration_months,
        ps.status AS subscription_status,
        ps.starts_at,
        ps.expires_at,
        ps.source_type,
        ps.created_at AS subscription_created_at

      FROM users u

      LEFT JOIN LATERAL (
        SELECT *
        FROM pro_subscriptions
        WHERE user_id = u.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) ps ON TRUE

      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserByTelegramId,
  getActiveSubscriptionByUserId,
  getLatestSubscriptionByUserId,
  createSubscription,
  setUserPro,
  setSubscriptionStatus,
  getUserProStatus,
};
