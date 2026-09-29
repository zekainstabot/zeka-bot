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

async function createReport({
  questionId,
  userId,
  reason,
  details = null,
}) {
  if (!questionId) {
    throw new Error(
      "Question ID is required"
    );
  }

  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  const normalizedReason =
    String(reason || "")
      .trim()
      .toUpperCase();

  if (
    !Object.values(
      REPORT_REASONS
    ).includes(
      normalizedReason
    )
  ) {
    throw new Error(
      "Invalid report reason"
    );
  }

  const report =
    await quizReportRepository.createReport(
      {
        questionId,
        userId,
        reason:
          normalizedReason,
        details:
          details || null,
      }
    );

  if (!report) {
    return {
      created: false,
      duplicate: true,
      report: null,
    };
  }

  return {
    created: true,
    duplicate: false,
    report,
  };
}

async function listPendingReports(
  telegramUserId,
  options = {}
) {
  await adminQuizService.requireQuizPermission(
    telegramUserId
  );

  return quizReportRepository.listPendingReports(
    options
  );
}

async function countPendingReports(
  telegramUserId
) {
  await adminQuizService.requireQuizPermission(
    telegramUserId
  );

  return quizReportRepository.countPendingReports();
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

  const normalizedStatus =
    String(status || "")
      .trim()
      .toUpperCase();

  if (
    !["RESOLVED", "REJECTED"].includes(
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

module.exports = {
  REPORT_REASONS,

  createReport,

  listPendingReports,

  countPendingReports,

  getReportById,

  resolveReport,
};
