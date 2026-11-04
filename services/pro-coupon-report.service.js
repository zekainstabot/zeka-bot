const { getPool } = require("../database/pool");

async function getCouponUsageReport(
  couponId,
  { limit = 10, offset = 0 } = {}
) {
  const db = getPool();

  const safeCouponId = Number(couponId);

  if (
    !Number.isSafeInteger(safeCouponId) ||
    safeCouponId < 1
  ) {
    throw new Error("INVALID_COUPON_ID");
  }

  const safeLimit = Math.max(
    1,
    Math.min(Math.floor(Number(limit) || 10), 50)
  );

  const safeOffset = Math.max(
    0,
    Math.floor(Number(offset) || 0)
  );

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
          request.coupon_discount_percent AS discount_percent,
          request.status AS purchase_status,
          request.created_at AS purchase_created_at,
          request.reviewed_at,

          COALESCE(
            redemption.created_at,
            request.created_at
          ) AS redemption_created_at

        FROM pro_purchase_requests request

        LEFT JOIN pro_discount_redemptions redemption
          ON redemption.purchase_request_id = request.id
          AND redemption.coupon_id = $1

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
        safeLimit,
        safeOffset,
      ]
    ),

    db.query(
      `
        SELECT
          COUNT(*)::INTEGER AS total,

          COUNT(*) FILTER (
            WHERE status = 'APPROVED'
          )::INTEGER AS approved_count,

          COUNT(*) FILTER (
            WHERE status IN (
              'PENDING',
              'WAITING_RECEIPT',
              'RECEIPT_SUBMITTED'
            )
          )::INTEGER AS pending_count,

          COUNT(*) FILTER (
            WHERE status = 'REJECTED'
          )::INTEGER AS rejected_count,

          COUNT(*) FILTER (
            WHERE status = 'CANCELLED'
          )::INTEGER AS cancelled_count

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

    total: Number(summary.total || 0),

    summary: {
      approved: Number(summary.approved_count || 0),
      pending: Number(summary.pending_count || 0),
      rejected: Number(summary.rejected_count || 0),
      cancelled: Number(summary.cancelled_count || 0),
    },

    limit: safeLimit,
    offset: safeOffset,
  };
}

module.exports = {
  getCouponUsageReport,
};
