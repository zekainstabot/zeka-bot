const { getPool } = require("../database/pool");

const {
  validateCouponId,
} = require("./pro-coupon.service");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function validatePagination(limit, offset) {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);

  if (
    !Number.isSafeInteger(parsedLimit) ||
    parsedLimit < 1
  ) {
    throw new Error("INVALID_REPORT_LIMIT");
  }

  if (
    !Number.isSafeInteger(parsedOffset) ||
    parsedOffset < 0
  ) {
    throw new Error("INVALID_REPORT_OFFSET");
  }

  return {
    limit: Math.min(parsedLimit, MAX_LIMIT),
    offset: parsedOffset,
  };
}

function parseCount(value) {
  const count = Number(value ?? 0);

  if (
    !Number.isSafeInteger(count) ||
    count < 0
  ) {
    throw new Error("INVALID_COUPON_REPORT_COUNT");
  }

  return count;
}

async function getCouponUsageReport(
  couponId,
  {
    limit = DEFAULT_LIMIT,
    offset = 0,
  } = {}
) {
  const safeCouponId = validateCouponId(couponId);

  const pagination = validatePagination(
    limit,
    offset
  );

  const db = getPool();

  const couponResult = await db.query(
    `
      SELECT
        id,
        code,
        discount_percent,
        max_uses,
        usage_count,
        is_active,
        starts_at,
        expires_at,
        created_at
      FROM pro_discount_coupons
      WHERE id = $1
      LIMIT 1
    `,
    [safeCouponId]
  );

  const coupon = couponResult.rows[0] || null;

  if (!coupon) {
    return null;
  }

  const [
    usageResult,
    summaryResult,
  ] = await Promise.all([
    db.query(
      `
        SELECT
          request.id AS purchase_request_id,
          request.telegram_user_id,
          request.username,
          request.display_name,
          request.duration_months,
          request.price_amount,
          request.base_price_amount,
          request.plan_discount_percent,
          request.extra_discount_percent,
          request.applied_discount_percent,

          request.coupon_discount_percent
            AS discount_percent,

          request.status AS purchase_status,
          request.created_at AS purchase_created_at,
          request.reviewed_at,

          COALESCE(
            redemption.redemption_created_at,
            request.created_at
          ) AS redemption_created_at,

          redemption.released_at

        FROM pro_purchase_requests request

        LEFT JOIN LATERAL (
          SELECT
            events.redemption_created_at,
            events.released_at

          FROM (
            SELECT
              active.created_at
                AS redemption_created_at,

              NULL::TIMESTAMPTZ
                AS released_at,

              1 AS source_priority

            FROM pro_discount_redemptions active

            WHERE active.purchase_request_id = request.id
              AND active.coupon_id = $1

            UNION ALL

            SELECT
              history.redemption_created_at,
              history.released_at,
              2 AS source_priority

            FROM pro_discount_redemption_history history

            WHERE history.purchase_request_id = request.id
              AND history.coupon_id = $1
          ) events

          ORDER BY events.source_priority DESC

          LIMIT 1
        ) redemption ON TRUE

        WHERE request.coupon_code = $2

        ORDER BY
          request.created_at DESC,
          request.id DESC

        LIMIT $3
        OFFSET $4
      `,
      [
        safeCouponId,
        coupon.code,
        pagination.limit,
        pagination.offset,
      ]
    ),

    db.query(
      `
        SELECT
          COUNT(*) AS total,

          COUNT(*) FILTER (
            WHERE status = 'APPROVED'
          ) AS approved_count,

          COUNT(*) FILTER (
            WHERE status IN (
              'PENDING',
              'WAITING_RECEIPT',
              'RECEIPT_SUBMITTED'
            )
          ) AS pending_count,

          COUNT(*) FILTER (
            WHERE status = 'REJECTED'
          ) AS rejected_count,

          COUNT(*) FILTER (
            WHERE status = 'CANCELLED'
          ) AS cancelled_count

        FROM pro_purchase_requests

        WHERE coupon_code = $1
      `,
      [coupon.code]
    ),
  ]);

  const summary = summaryResult.rows[0] || {};

  return {
    coupon,

    redemptions: usageResult.rows,

    total: parseCount(summary.total),

    summary: {
      approved: parseCount(summary.approved_count),
      pending: parseCount(summary.pending_count),
      rejected: parseCount(summary.rejected_count),
      cancelled: parseCount(summary.cancelled_count),
    },

    limit: pagination.limit,
    offset: pagination.offset,
  };
}

module.exports = {
  getCouponUsageReport,
};
