UPDATE quiz_question_reports
SET status = 'PENDING'
WHERE status IS NULL
   OR status NOT IN (
     'PENDING',
     'UNREVIEWED',
     'REVIEWED',
     'REJECTED'
   );

ALTER TABLE quiz_question_reports
DROP CONSTRAINT IF EXISTS quiz_question_reports_status_check;

ALTER TABLE quiz_question_reports
ADD CONSTRAINT quiz_question_reports_status_check
CHECK (
  status IN (
    'PENDING',
    'UNREVIEWED',
    'REVIEWED',
    'REJECTED'
  )
);
