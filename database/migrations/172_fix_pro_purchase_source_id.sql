
BEGIN;

-- بررسی معتبر بودن شناسه درخواست خرید در metadata
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pro_subscriptions
        WHERE source_type = 'PURCHASE'
          AND (
              metadata IS NULL
              OR NOT (metadata ? 'purchase_request_id')
              OR (metadata->>'purchase_request_id') !~ '^[0-9]+$'
          )
    ) THEN
        RAISE EXCEPTION
            'Cannot repair Pro purchase source IDs: missing or invalid purchase_request_id metadata';
    END IF;
END;
$$;

-- جلوگیری از اتصال چند اشتراک به یک درخواست خرید
DO $$
BEGIN
    IF EXISTS (
        SELECT metadata->>'purchase_request_id'
        FROM pro_subscriptions
        WHERE source_type = 'PURCHASE'
        GROUP BY metadata->>'purchase_request_id'
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot repair Pro purchase source IDs: duplicate purchase_request_id values found';
    END IF;
END;
$$;

-- اصلاح source_id اشتراک‌های خرید قدیمی
UPDATE pro_subscriptions
SET
    source_id = (metadata->>'purchase_request_id')::BIGINT,
    updated_at = NOW()
WHERE source_type = 'PURCHASE'
  AND source_id IS DISTINCT FROM
      (metadata->>'purchase_request_id')::BIGINT;

-- جلوگیری از ثبت چند اشتراک برای یک درخواست خرید
CREATE UNIQUE INDEX IF NOT EXISTS
    uq_pro_subscription_purchase_source
ON pro_subscriptions (source_id)
WHERE source_type = 'PURCHASE';

COMMIT;
