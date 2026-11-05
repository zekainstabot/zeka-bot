-- Backfill coupon redemption history for old rejected/cancelled
-- purchase requests.
--
-- Historical redemption/release timestamps cannot be recovered
-- exactly after the active redemption row has been deleted.
-- created_at and updated_at are used as best available timestamps.

INSERT INTO pro_discount_redemption_history (
    coupon_id,
    purchase_request_id,
    telegram_user_id,
    discount_percent,
    purchase_status,
    redemption_created_at,
    released_at
)
SELECT
    coupon.id,
    request.id,
    request.telegram_user_id,
    request.coupon_discount_percent,
    request.status,
    request.created_at,
    GREATEST(
        request.updated_at,
        request.created_at
    )
FROM pro_purchase_requests request

INNER JOIN pro_discount_coupons coupon
    ON coupon.code = request.coupon_code

WHERE request.status IN (
    'REJECTED',
    'CANCELLED'
)
AND request.coupon_code IS NOT NULL
AND request.coupon_discount_percent BETWEEN 1 AND 90

-- Do not overwrite history already recorded by the application.
ON CONFLICT (purchase_request_id)
DO NOTHING;
