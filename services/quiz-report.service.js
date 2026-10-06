const adminManagementService = require(
  "./admin-management.service"
);

const quizReportRepository = require(
  "../repositories/quiz-report.repository"
);

const REPORT_REASONS = {
  WRONG_ANSWER: "WRONG_ANSWER",
  BAD_QUESTION: "BAD_QUESTION",
  BAD_OPTIONS: "BAD_OPTIONS",
  DUPLICATE: "DUPLICATE",
  UNRELIABLE: "UNRELIABLE",
  OTHER: "OTHER",
};

function normalizeReason(reason) {
  const value = String(reason || "")
    .trim()
    .toUpperCase();

  if (!value) {
    return null;
  }

  if (
    !Object.values(REPORT_REASONS).includes(
      value
    )
  ) {
    throw new Error(
      "Invalid report reason"
    );
  }

  return value;
}

function normalizeStatus(status) {
  const value = String(status || "")
    .trim()
    .toUpperCase();

  const allowedStatuses = [
    "PENDING",
    "UNREVIEWED",
    "REVIEWED",
    "REJECTED",
  ];

  if (!allowedStatuses.includes(value)) {
    throw new Error(
      "Invalid report status"
    );
  }

  return value;
}

async function requireReportsPermission(
  telegramUserId
) {
  return adminManagementService.requirePermissionByTelegramId(
    telegramUserId,
    "reports"
  );
}

async function createReport({
  questionId,
  userId,
  reason,
  details = null,
}) {
  const normalizedReason =
    normalizeReason(reason);

  if (!normalizedReason) {
    throw new Error(
      "Invalid report reason"
    );
  }

  const report =
    await quizReportRepository.createReport({
      questionId,
      userId,
      reason: normalizedReason,
      details,
    });

  if (report) {
    return {
      created: true,
      duplicate: false,
      report,
    };
  }

  return {
    created: false,
    duplicate: true,
    report: null,
  };
}

async function listPendingReports(
  telegramUserId,
  options = {}
) {
  await requireReportsPermission(
    telegramUserId
  );

  const normalizedReason =
    normalizeReason(options.reason);

  return quizReportRepository.listPendingReports({
    ...options,
    reason: normalizedReason,
  });
}

async function countPendingReports(
  telegramUserId,
  options = {}
) {
  await requireReportsPermission(
    telegramUserId
  );

  const normalizedReason =
    normalizeReason(options.reason);

  return quizReportRepository.countPendingReports({
    reason: normalizedReason,
  });
}

async function countPendingReportsByReason(
  telegramUserId
) {
  await requireReportsPermission(
    telegramUserId
  );

  return quizReportRepository.countPendingReportsByReason();
}

async function getReportById(
  telegramUserId,
  reportId
) {
  await requireReportsPermission(
    telegramUserId
  );

  return quizReportRepository.getReportById(
    reportId
  );
}

async function listReportsByStatus(
  telegramUserId,
  status,
  options = {}
) {
  await requireReportsPermission(
    telegramUserId
  );

  const normalizedStatus =
    normalizeStatus(status);

  return quizReportRepository.listReportsByStatus(
    normalizedStatus,
    options
  );
}

async function countByStatus(
  telegramUserId,
  status
) {
  await requireReportsPermission(
    telegramUserId
  );

  const normalizedStatus =
    normalizeStatus(status);

  return quizReportRepository.countByStatus(
    normalizedStatus
  );
}

async function countReviewedArchive(
  telegramUserId
) {
  await requireReportsPermission(
    telegramUserId
  );

  return quizReportRepository.countReviewedArchive();
}

async function markReviewed(
  telegramUserId,
  reportId,
  adminNote = null
) {
  const admin =
    await requireReportsPermission(
      telegramUserId
    );

  return quizReportRepository.markReviewed(
    reportId,
    admin.user_id,
    adminNote
  );
}

async function restoreToPending(
  telegramUserId,
  reportId
) {
  await requireReportsPermission(
    telegramUserId
  );

  return quizReportRepository.restoreToPending(
    reportId
  );
}

async function resolveReport(
  telegramUserId,
  reportId,
  status,
  adminNote = null
) {
  const admin =
    await requireReportsPermission(
      telegramUserId
    );

  const normalizedStatus =
    String(status)
      .trim()
      .toUpperCase();

  const allowedStatuses = [
    "RESOLVED",
    "REJECTED",
  ];

  if (
    !allowedStatuses.includes(
      normalizedStatus
    )
  ) {
    throw new Error(
      "Invalid report status"
    );
  }

  return quizReportRepository.resolveReport(
    reportId,
    normalizedStatus,
    admin.user_id,
    adminNote
  );
}

async function deleteReport(
  telegramUserId,
  reportId
) {
  await requireReportsPermission(
    telegramUserId
  );

  return quizReportRepository.deleteById(
    reportId
  );
}

module.exports = {
  REPORT_REASONS,

  createReport,

  listPendingReports,
  countPendingReports,
  countPendingReportsByReason,

  getReportById,

  listReportsByStatus,
  countByStatus,
  countReviewedArchive,

  markReviewed,
  restoreToPending,

  resolveReport,

  deleteReport,
};
