BEGIN;

-- Ensure every historical PURCHASE subscription has
-- a valid purchase request ID in metadata.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pro_subscriptions
        WHERE source_type = 'PURCHASE'
          AND (
              metadata IS NULL
              OR NOT (
                  metadata ? 'purchase_request_id'
              )
              OR (metadata->>'purchase_request_id')
                    !~ '^[0-9]+$'
          )
    ) THEN
        RAISE EXCEPTION
            'Cannot repair Pro purchase source IDs: missing or invalid purchase_request_id metadata';
    END IF;
END;
$$;

-- Restore the correct purchase request reference.
UPDATE pro_subscriptions
SET
    source_id = (metadata->>'purchase_request_id')::BIGINT,
    updated_at = NOW()
WHERE source_type = 'PURCHASE'
  AND source_id IS DISTINCT FROM
      (metadata->>'purchase_request_id')::BIGINT;

-- Prevent duplicate subscriptions for one purchase request.
CREATE UNIQUE INDEX IF NOT EXISTS
    uq_pro_subscription_purchase_source
ON pro_subscriptions (source_id)
WHERE source_type = 'PURCHASE';

COMMIT;
