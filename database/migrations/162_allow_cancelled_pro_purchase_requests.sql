
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
            'REJECTED',
            'CANCELLED'
        )
    );
