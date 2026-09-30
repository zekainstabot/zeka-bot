const adminService = require("./admin.service");
const adminQuizRepository = require(
  "../repositories/admin-quiz.repository"
);

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

async function getQuestionById(
  telegramUserId,
  questionId
) {
  await requireQuizPermission(
    telegramUserId
  );

  const question =
    await adminQuizRepository.getQuestionById(
      questionId
    );

  if (!question) {
    const error = new Error(
      "Question not found"
    );

    error.code =
      "QUESTION_NOT_FOUND";

    throw error;
  }

  return question;
}

async function listQuestions(
  telegramUserId,
  {
    search = "",
    status = "ALL",
    categoryId = null,
    limit = 10,
    offset = 0,
  } = {}
) {
  await requireQuizPermission(
    telegramUserId
  );

  return adminQuizRepository.listQuestions({
    search,
    status,
    categoryId,
    limit,
    offset,
  });
}

async function countQuestions(
  telegramUserId,
  {
    search = "",
    status = "ALL",
    categoryId = null,
  } = {}
) {
  await requireQuizPermission(
    telegramUserId
  );

  return adminQuizRepository.countQuestions({
    search,
    status,
    categoryId,
  });
}

async function listCategories(
  telegramUserId
) {
  await requireQuizPermission(
    telegramUserId
  );

  return adminQuizRepository.listCategories();
}

async function updateQuestion({
  telegramUserId,
  questionId,
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

  const question =
    await adminQuizRepository.getQuestionById(
      questionId
    );

  if (!question) {
    const error = new Error(
      "Question not found"
    );

    error.code =
      "QUESTION_NOT_FOUND";

    throw error;
  }

  return adminQuizRepository.updateQuestion({
    questionId,
    category,
    difficulty,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation,
    updatedBy: admin.user_id,
  });
}

async function updateQuestionStatus({
  telegramUserId,
  questionId,
  status,
}) {
  const admin =
    await requireQuizPermission(
      telegramUserId
    );

  const question =
    await adminQuizRepository.getQuestionById(
      questionId
    );

  if (!question) {
    const error = new Error(
      "Question not found"
    );

    error.code =
      "QUESTION_NOT_FOUND";

    throw error;
  }

  return adminQuizRepository.updateQuestionStatus({
    questionId,
    status,
    updatedBy: admin.user_id,
  });
}

module.exports = {
  requireQuizPermission,
  createQuestion,
  countActiveQuestions,
  getQuestionById,
  listQuestions,
  countQuestions,
  listCategories,
  updateQuestion,
  updateQuestionStatus,
};
