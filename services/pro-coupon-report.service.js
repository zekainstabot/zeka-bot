
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
          redemption.id AS redemption_id,
          redemption.telegram_user_id,
          redemption.discount_percent,
          redemption.created_at AS redemption_created_at,

          request.id AS purchase_request_id,
          request.username,
          request.display_name,
          request.duration_months,
          request.price_amount,
          request.base_price_amount,
          request.status AS purchase_status,
          request.created_at AS purchase_created_at,
          request.reviewed_at

        FROM pro_discount_redemptions redemption

        LEFT JOIN pro_purchase_requests request
          ON request.id = redemption.purchase_request_id

        WHERE redemption.coupon_id = $1

        ORDER BY
          redemption.created_at DESC,
          redemption.id DESC

        LIMIT $2
        OFFSET $3
      `,
      [
        safeCouponId,
        safeLimit,
        safeOffset,
      ]
    ),

    db.query(
      `
        SELECT
          COUNT(*)::INTEGER AS total,

          COUNT(*) FILTER (
            WHERE request.status = 'APPROVED'
          )::INTEGER AS approved_count,

          COUNT(*) FILTER (
            WHERE request.status IN (
              'PENDING',
              'WAITING_RECEIPT',
              'RECEIPT_SUBMITTED'
            )
          )::INTEGER AS pending_count,

          COUNT(*) FILTER (
            WHERE request.status = 'REJECTED'
          )::INTEGER AS rejected_count,

          COUNT(*) FILTER (
            WHERE request.status = 'CANCELLED'
          )::INTEGER AS cancelled_count

        FROM pro_discount_redemptions redemption

        LEFT JOIN pro_purchase_requests request
          ON request.id = redemption.purchase_request_id

        WHERE redemption.coupon_id = $1
      `,
      [safeCouponId]
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
