const adminService = require("./admin.service");
const adminQuizRepository = require("../repositories/admin-quiz.repository");

const QUIZ_MANAGE_PERMISSION =
  "games.quiz.manage";

async function requireQuizPermission(
  telegramUserId
) {
  const admin =
    await adminService.getAdminByTelegramId(
      telegramUserId
    );

  if (!admin || !admin.is_active) {
    const error = new Error(
      "Admin access denied"
    );

    error.code =
      "ADMIN_ACCESS_DENIED";

    throw error;
  }

  const allowed =
    await adminService.hasPermission(
      admin.user_id,
      QUIZ_MANAGE_PERMISSION
    );

  if (!allowed) {
    const error = new Error(
      "Quiz management permission denied"
    );

    error.code =
      "PERMISSION_DENIED";

    error.permission =
      QUIZ_MANAGE_PERMISSION;

    throw error;
  }

  return admin;
}

async function createQuestion({
  telegramUserId,
  languageCode,
  category,
  difficulty,
  questionText,
  optionA,
  optionB,
  optionC,
  optionD,
  correctOption,
  explanation = null,
}) {
  const admin =
    await requireQuizPermission(
      telegramUserId
    );

  return adminQuizRepository.createQuestion({
    languageCode,
    category,
    difficulty,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation,
    createdBy: admin.user_id,
  });
}

async function countActiveQuestions(
  telegramUserId
) {
  await requireQuizPermission(
    telegramUserId
  );

  return adminQuizRepository.countActiveQuestions();
}

module.exports = {
  requireQuizPermission,
  createQuestion,
  countActiveQuestions,
};
