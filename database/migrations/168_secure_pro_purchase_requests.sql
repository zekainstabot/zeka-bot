-- Keep only one open purchase request per Telegram user.
-- Prefer a request that already has a submitted receipt.

WITH ranked_requests AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY telegram_user_id
            ORDER BY
                CASE
                    WHEN status = 'RECEIPT_SUBMITTED' THEN 0
                    WHEN status = 'WAITING_RECEIPT' THEN 1
                    WHEN status = 'PENDING' THEN 2
                    ELSE 3
                END,
                created_at DESC,
                id DESC
        ) AS row_number
    FROM pro_purchase_requests
    WHERE status IN (
        'PENDING',
        'WAITING_RECEIPT',
        'RECEIPT_SUBMITTED'
    )
)

UPDATE pro_purchase_requests AS requests
SET
    status = 'CANCELLED',
    updated_at = NOW()
FROM ranked_requests
WHERE requests.id = ranked_requests.id
  AND ranked_requests.row_number > 1;


-- Database-level protection against concurrent duplicate requests.

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_pro_purchase_one_open_request_per_user
ON pro_purchase_requests (telegram_user_id)
WHERE status IN (
    'PENDING',
    'WAITING_RECEIPT',
    'RECEIPT_SUBMITTED'
);
