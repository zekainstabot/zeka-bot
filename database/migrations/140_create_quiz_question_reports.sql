CREATE TABLE IF NOT EXISTS quiz_question_reports (
  id BIGSERIAL PRIMARY KEY,

  question_id BIGINT NOT NULL
    REFERENCES quiz_questions(id)
    ON DELETE CASCADE,

  user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  reason VARCHAR(50) NOT NULL,

  details TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (
      status IN (
        'PENDING',
        'RESOLVED',
        'REJECTED'
      )
    ),

  reviewed_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  reviewed_at TIMESTAMPTZ,

  admin_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_quiz_reports_one_pending
ON quiz_question_reports (
  question_id,
  user_id
)
WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS
  idx_quiz_reports_status_created
ON quiz_question_reports (
  status,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_quiz_reports_question
ON quiz_question_reports (
  question_id
);

CREATE INDEX IF NOT EXISTS
  idx_quiz_reports_user
ON quiz_question_reports (
  user_id
);
