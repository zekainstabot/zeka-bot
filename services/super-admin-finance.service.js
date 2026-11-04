const { getClient } = require("../database/client");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function normalizeLimit(limit) {
  const parsed = Number(limit);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(
    1,
    Math.min(
      Math.floor(parsed),
      MAX_LIMIT
    )
  );
}

// --------------------------------------------------
// Transactions
// --------------------------------------------------

async function getLatestTransactions(limit = DEFAULT_LIMIT) {
  const db = getClient();
  const safeLimit = normalizeLimit(limit);

  const result = await db.query(
    `
      SELECT
        pt.id AS transaction_db_id,
        pt.transaction_id,
        pt.transaction_type,
        pt.status AS transaction_status,
        pt.amount AS transaction_amount,
        pt.currency AS transaction_currency,
        pt.reference_number,
        pt.verified_at,
        pt.created_at AS transaction_created_at,

        p.payment_id,
        p.payment_type,
        p.provider,
        p.status AS payment_status,
        p.amount AS payment_amount,
        p.currency AS payment_currency,
        p.paid_at,

        u.telegram_user_id,
        u.username,
        u.display_name

      FROM payment_transactions pt

      INNER JOIN payments p
        ON p.id = pt.payment_id

      INNER JOIN users u
        ON u.id = p.user_id

      ORDER BY
        pt.created_at DESC,
        pt.id DESC

      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function getTransactionCount() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT COUNT(*)::BIGINT AS total
      FROM payment_transactions
    `
  );

  return Number(
    result.rows[0]?.total || 0
  );
}

// --------------------------------------------------
// Pro revenue summary
// --------------------------------------------------

async function getProRevenueSummary() {
  const db = getClient();

  const result = await db.query(
    `
      WITH time_boundaries AS (
        SELECT
          (
            date_trunc(
              'day',
              NOW() AT TIME ZONE 'Asia/Tehran'
            ) AT TIME ZONE 'Asia/Tehran'
          ) AS today_start,

          (
            date_trunc(
              'month',
              NOW() AT TIME ZONE 'Asia/Tehran'
            ) AT TIME ZONE 'Asia/Tehran'
          ) AS month_start
      )

      SELECT
        COUNT(*) FILTER (
          WHERE subscription.price > 0
        )::BIGINT AS paid_subscription_count,

        COALESCE(
          SUM(subscription.price) FILTER (
            WHERE subscription.price > 0
          ),
          0
        ) AS total_revenue,

        COUNT(*) FILTER (
          WHERE subscription.price = 0
        )::BIGINT AS zero_price_subscription_count,

        COUNT(*) FILTER (
          WHERE subscription.price > 0
            AND subscription.created_at >= boundaries.month_start
        )::BIGINT AS current_month_subscription_count,

        COALESCE(
          SUM(subscription.price) FILTER (
            WHERE subscription.price > 0
              AND subscription.created_at >= boundaries.month_start
          ),
          0
        ) AS current_month_revenue,

        COUNT(*) FILTER (
          WHERE subscription.price > 0
            AND subscription.created_at >= boundaries.today_start
        )::BIGINT AS today_subscription_count,

        COALESCE(
          SUM(subscription.price) FILTER (
            WHERE subscription.price > 0
              AND subscription.created_at >= boundaries.today_start
          ),
          0
        ) AS today_revenue

      FROM pro_subscriptions subscription

      CROSS JOIN time_boundaries boundaries

      WHERE subscription.source_type = 'PURCHASE'
    `
  );

  const row = result.rows[0] || {};

  return {
    paidSubscriptionCount: Number(
      row.paid_subscription_count || 0
    ),

    totalRevenue: Number(
      row.total_revenue || 0
    ),

    zeroPriceSubscriptionCount: Number(
      row.zero_price_subscription_count || 0
    ),

    currentMonthSubscriptionCount: Number(
      row.current_month_subscription_count || 0
    ),

    currentMonthRevenue: Number(
      row.current_month_revenue || 0
    ),

    todaySubscriptionCount: Number(
      row.today_subscription_count || 0
    ),

    todayRevenue: Number(
      row.today_revenue || 0
    ),
  };
}

// --------------------------------------------------
// Latest Pro sales
// --------------------------------------------------

async function getLatestProSales(limit = DEFAULT_LIMIT) {
  const db = getClient();
  const safeLimit = normalizeLimit(limit);

  const result = await db.query(
    `
      SELECT
        subscription.id,
        subscription.subscription_id,
        subscription.plan_type,
        subscription.duration_months,
        subscription.status,
        subscription.starts_at,
        subscription.expires_at,
        subscription.price,
        subscription.currency,
        subscription.metadata,
        subscription.created_at,

        users.telegram_user_id,
        users.username,
        users.display_name

      FROM pro_subscriptions subscription

      INNER JOIN users
        ON users.id = subscription.user_id

      WHERE subscription.source_type = 'PURCHASE'
        AND subscription.price > 0

      ORDER BY
        subscription.created_at DESC,
        subscription.id DESC

      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

// --------------------------------------------------
// Exports
// --------------------------------------------------

module.exports = {
  getLatestTransactions,
  getTransactionCount,
  getProRevenueSummary,
  getLatestProSales,
};
