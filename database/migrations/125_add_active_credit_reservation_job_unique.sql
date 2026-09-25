CREATE UNIQUE INDEX IF NOT EXISTS ux_credit_reservations_active_job
    ON credit_reservations(job_id)
    WHERE status = 'RESERVED'
      AND job_id IS NOT NULL;
