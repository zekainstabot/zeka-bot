
ALTER TABLE pro_purchase_requests
    DROP CONSTRAINT IF EXISTS pro_purchase_requests_status_check;

ALTER TABLE pro_purchase_requests
    ADD CONSTRAINT pro_purchase_requests_status_check
    CHECK (
        status IN (
            'PENDING',
            'WAITING_RECEIPT',
            'RECEIPT_SUBMITTED',
            'APPROVED',
            'REJECTED'
        )
    );

ALTER TABLE pro_purchase_requests
    ADD COLUMN IF NOT EXISTS payment_card_number TEXT,
    ADD COLUMN IF NOT EXISTS receipt_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS receipt_text TEXT,
    ADD COLUMN IF NOT EXISTS receipt_file_id TEXT,
    ADD COLUMN IF NOT EXISTS receipt_submitted_at TIMESTAMPTZ;
