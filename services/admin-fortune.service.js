const adminService = require("./admin.service");

const fortuneRepository = require(
  "../repositories/fortune.repository"
);

const FORTUNE_MANAGE_PERMISSION =
  "features.fortune.manage";

async function requireFortunePermission(
  telegramUserId
) {
  const admin =
    await adminService.getAdminByTelegramId(
      telegramUserId
    );

  if (
    !admin ||
    !admin.is_active
  ) {
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
      FORTUNE_MANAGE_PERMISSION
    );

  if (!allowed) {
    const error = new Error(
      "Fortune management permission denied"
    );

    error.code =
      "PERMISSION_DENIED";

    error.permission =
      FORTUNE_MANAGE_PERMISSION;

    throw error;
  }

  return admin;
}

async function listCategories(
  telegramUserId
) {
  await requireFortunePermission(
    telegramUserId
  );

  return fortuneRepository.listCategories({
    activeOnly: true,
  });
}

async function createManualFortune({
  telegramUserId,
  categoryId,
  title = null,
  content,
}) {
  const admin =
    await requireFortunePermission(
      telegramUserId
    );

  if (!categoryId) {
    throw new Error(
      "Fortune category is required"
    );
  }

  if (
    !content ||
    !String(content).trim()
  ) {
    throw new Error(
      "Fortune content is required"
    );
  }

  return fortuneRepository.createFortune({
    categoryId,
    title:
      title &&
      String(title).trim()
        ? String(title).trim()
        : null,
    content:
      String(content).trim(),
    createdBy:
      admin.user_id,
  });
}

async function countFortunes(
  telegramUserId,
  categoryId = null
) {
  await requireFortunePermission(
    telegramUserId
  );

  return fortuneRepository.countFortunes({
    categoryId,
    activeOnly: true,
  });
}

module.exports = {
  requireFortunePermission,
  listCategories,
  createManualFortune,
  countFortunes,
};
