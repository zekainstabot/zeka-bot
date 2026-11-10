const adminService = require("./admin.service");
const {
  normalizeCorrectOptionIndex,
} = require("./admin-quiz-import.service");

const adminQuizRepository = require(
  "../repositories/admin-quiz.repository"
);

const adminManagementService = require(
  "./admin-management.service"
);

const QUIZ_MANAGE_PERMISSION = "games.quiz";
const REPORT_MANAGE_PERMISSION = "reports";

async function requireQuizPermission(telegramUserId) {
  const admin = await adminService.getAdminByTelegramId(
    telegramUserId
  );

  if (!admin || !admin.is_active) {
    const error = new Error("Admin access denied");
    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  const allowed = await adminService.hasPermission(
    admin.user_id,
    QUIZ_MANAGE_PERMISSION
  );

  if (!allowed) {
    const error = new Error(
      "Quiz management permission denied"
    );

    error.code = "PERMISSION_DENIED";
    error.permission = QUIZ_MANAGE_PERMISSION;

    throw error;
  }

  return admin;
}

async function requireReportManagePermission(telegramUserId) {
  return adminManagementService.requirePermissionByTelegramId(
    telegramUserId,
    REPORT_MANAGE_PERMISSION
  );
}

async function resolveCategory(categoryId) {
  if (
    categoryId === null ||
    categoryId === undefined ||
    categoryId === ""
  ) {
    return null;
  }

  const normalizedId = Number(categoryId);

  if (
    !Number.isInteger(normalizedId) ||
    normalizedId <= 0
  ) {
    throw new Error("Invalid category ID");
  }

  const categories =
    await adminQuizRepository.listCategories();

  const category = categories.find(
    (item) => Number(item.id) === normalizedId
  );

  if (!category) {
    const error = new Error("Quiz category not found");
    error.code = "CATEGORY_NOT_FOUND";
    throw error;
  }

  return category;
}

async function createQuestion({
  telegramUserId,
  languageCode = "fa",
  category,
  categoryId = null,
  difficulty,
  questionText,
  optionA,
  optionB,
  optionC,
  optionD,
  correctOption,
  explanation = null,
}) {
  const admin = await requireQuizPermission(
    telegramUserId
  );

  const selectedCategory = await resolveCategory(
    categoryId
  );

  return adminQuizRepository.createQuestion({
    languageCode,
    category: selectedCategory
      ? selectedCategory.slug
      : category,
    categoryId: selectedCategory
      ? selectedCategory.id
      : null,
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

/**
 * واردکردن گروهی سؤال‌های استخراج‌شده از سایت.
 */
async function importQuestions({
  telegramUserId,
  questions,
  categoryId,
  difficulty,
  languageCode = "fa",
}) {
  const admin = await requireQuizPermission(
    telegramUserId
  );

  if (
    !Array.isArray(questions) ||
    questions.length === 0
  ) {
    throw new Error("Questions list is empty");
  }

  if (questions.length > 100) {
    throw new Error(
      "Maximum 100 questions can be imported"
    );
  }

  const normalizedDifficulty = String(
    difficulty || ""
  ).trim().toUpperCase();

  if (
    !["EASY", "MEDIUM", "HARD"].includes(
      normalizedDifficulty
    )
  ) {
    throw new Error("Invalid quiz difficulty");
  }

  const selectedCategory = await resolveCategory(
    categoryId
  );

  if (!selectedCategory) {
    throw new Error("Invalid category ID");
  }

  const preparedQuestions = [];

  let invalid = 0;

  for (const question of questions) {
    if (!question) {
      invalid++;
      continue;
    }

    const options = Array.isArray(question.options)
      ? question.options
      : [];

    const correctIndex = normalizeCorrectOptionIndex(
      question.correctOption
    );

    const questionText = String(
      question.question || ""
    ).trim();

    const normalizedOptions = options.map(
      (option) => String(option || "").trim()
    );

    if (
      !questionText ||
      normalizedOptions.length !== 4 ||
      normalizedOptions.some((option) => !option) ||
      correctIndex === null
    ) {
      invalid++;
      continue;
    }

    preparedQuestions.push({
      questionText,

      optionA: normalizedOptions[0],
      optionB: normalizedOptions[1],
      optionC: normalizedOptions[2],
      optionD: normalizedOptions[3],

      correctOption: ["A", "B", "C", "D"][
        correctIndex
      ],

      explanation: question.explanation || null,
    });
  }

  if (preparedQuestions.length === 0) {
    return {
      inserted: 0,
      duplicates: 0,
      invalid,
      questions: [],
    };
  }

  const result = await adminQuizRepository.importQuestions({
    questions: preparedQuestions,
    languageCode,
    category: selectedCategory.slug,
    categoryId: selectedCategory.id,
    difficulty: normalizedDifficulty,
    createdBy: admin.user_id,
  });

  return {
    ...result,
    invalid: invalid + Number(result.invalid || 0),
  };
}

async function countActiveQuestions(telegramUserId) {
  await requireQuizPermission(telegramUserId);

  return adminQuizRepository.countActiveQuestions();
}

async function getQuestionById(
  telegramUserId,
  questionId
) {
  await requireQuizPermission(telegramUserId);

  const question =
    await adminQuizRepository.getQuestionById(
      questionId
    );

  if (!question) {
    const error = new Error("Question not found");
    error.code = "QUESTION_NOT_FOUND";
    throw error;
  }

  return question;
}

async function getQuestionByIdForReport(
  telegramUserId,
  questionId
) {
  await requireReportManagePermission(telegramUserId);

  const question =
    await adminQuizRepository.getQuestionById(
      questionId
    );

  if (!question) {
    const error = new Error("Question not found");
    error.code = "QUESTION_NOT_FOUND";
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
  await requireQuizPermission(telegramUserId);

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
  await requireQuizPermission(telegramUserId);

  return adminQuizRepository.countQuestions({
    search,
    status,
    categoryId,
  });
}

async function listCategories(telegramUserId) {
  await requireQuizPermission(telegramUserId);

  return adminQuizRepository.listCategories();
}

async function updateQuestion({
  telegramUserId,
  questionId,
  category,
  categoryId = null,
  difficulty,
  questionText,
  optionA,
  optionB,
  optionC,
  optionD,
  correctOption,
  explanation = null,
}) {
  const admin = await requireQuizPermission(
    telegramUserId
  );

  const question =
    await adminQuizRepository.getQuestionById(
      questionId
    );

  if (!question) {
    const error = new Error("Question not found");
    error.code = "QUESTION_NOT_FOUND";
    throw error;
  }

  const selectedCategory = await resolveCategory(
    categoryId
  );

  return adminQuizRepository.updateQuestion({
    questionId,
    category: selectedCategory
      ? selectedCategory.slug
      : category,
    categoryId: selectedCategory
      ? selectedCategory.id
      : null,
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

async function updateQuestionFromReport({
  telegramUserId,
  questionId,
  category,
  categoryId = null,
  difficulty,
  questionText,
  optionA,
  optionB,
  optionC,
  optionD,
  correctOption,
  explanation = null,
}) {
  const admin = await requireReportManagePermission(
    telegramUserId
  );

  const question =
    await adminQuizRepository.getQuestionById(
      questionId
    );

  if (!question) {
    const error = new Error("Question not found");
    error.code = "QUESTION_NOT_FOUND";
    throw error;
  }

  const selectedCategory = await resolveCategory(
    categoryId
  );

  return adminQuizRepository.updateQuestion({
    questionId,
    category: selectedCategory
      ? selectedCategory.slug
      : category,
    categoryId: selectedCategory
      ? selectedCategory.id
      : null,
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
  const admin = await requireQuizPermission(
    telegramUserId
  );

  const question =
    await adminQuizRepository.getQuestionById(
      questionId
    );

  if (!question) {
    const error = new Error("Question not found");
    error.code = "QUESTION_NOT_FOUND";
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
  requireReportManagePermission,
  createQuestion,
  importQuestions,
  countActiveQuestions,
  getQuestionById,
  getQuestionByIdForReport,
  listQuestions,
  countQuestions,
  listCategories,
  updateQuestion,
  updateQuestionFromReport,
  updateQuestionStatus,
};
