const adminQuizService = require("./admin-quiz.service");
const quizReportRepository = require("../repositories/quiz-report.repository");

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

  if (!Object.values(REPORT_REASONS).includes(value)) {
    throw new Error("Invalid report reason");
  }

  return value;
}

async function createReport({
  questionId,
  userId,
  reason,
  details = null,
}) {
  const normalizedReason = normalizeReason(reason);

  if (!normalizedReason) {
    throw new Error("Invalid report reason");
  }

  return quizReportRepository.createReport({
    questionId,
    userId,
    reason: normalizedReason,
    details,
  });
}

async function listPendingReports(
  telegramUserId,
  options = {}
) {
  await adminQuizService.requireQuizPermission(
    telegramUserId
  );

  const normalizedReason = normalizeReason(
    options.reason
  );

  return quizReportRepository.listPendingReports({
    ...options,
    reason: normalizedReason,
  });
}

async function countPendingReports(
  telegramUserId,
  options = {}
) {
  await adminQuizService.requireQuizPermission(
    telegramUserId
  );

  const normalizedReason = normalizeReason(
    options.reason
  );

  return quizReportRepository.countPendingReports({
    reason: normalizedReason,
  });
}

async function countPendingReportsByReason(
  telegramUserId
) {
  await adminQuizService.requireQuizPermission(
    telegramUserId
  );

  return quizReportRepository.countPendingReportsByReason();
}

async function getReportById(
  telegramUserId,
  reportId
) {
  await adminQuizService.requireQuizPermission(
    telegramUserId
  );

  return quizReportRepository.getReportById(
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
    await adminQuizService.requireQuizPermission(
      telegramUserId
    );

  const allowedStatuses = [
    "RESOLVED",
    "REJECTED",
  ];

  const normalizedStatus = String(status)
    .trim()
    .toUpperCase();

  if (!allowedStatuses.includes(normalizedStatus)) {
    throw new Error("Invalid report status");
  }

  return quizReportRepository.resolveReport(
    reportId,
    normalizedStatus,
    admin.user_id,
    adminNote
  );
}

module.exports = {
  REPORT_REASONS,
  createReport,
  listPendingReports,
  countPendingReports,
  countPendingReportsByReason,
  getReportById,
  resolveReport,
};
