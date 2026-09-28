const crypto = require("crypto");

const adminService = require("./admin.service");
const proRepository = require("../repositories/pro.repository");

const PRO_MANAGE_PERMISSION = "pro.manage";

const ALLOWED_DURATIONS = [
  1,
  2,
  3,
  6,
  12,
];

function createSubscriptionId() {
  return (
    "PRO-ADMIN-" +
    Date.now() +
    "-" +
    crypto.randomBytes(4).toString("hex")
  );
}

function addMonths(date, months) {
  const result = new Date(date);

  const originalDay = result.getUTCDate();

  result.setUTCMonth(
    result.getUTCMonth() + months
  );

  // جلوگیری از مشکل روزهای انتهای ماه
  if (
    result.getUTCDate() !== originalDay
  ) {
    result.setUTCDate(0);
  }

  return result;
}

async function requireProManagePermission(
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

  if (
    admin.role_key !==
    "super_admin"
  ) {
    const error = new Error(
      "Super admin access required"
    );

    error.code =
      "SUPER_ADMIN_REQUIRED";

    throw error;
  }

  const allowed =
    await adminService.hasPermission(
      admin.user_id,
      PRO_MANAGE_PERMISSION
    );

  if (!allowed) {
    const error = new Error(
      "Pro management permission denied"
    );

    error.code =
      "PERMISSION_DENIED";

    error.permission =
      PRO_MANAGE_PERMISSION;

    throw error;
  }

  return admin;
}

async function getTargetUser(
  telegramUserId
) {
  const user =
    await proRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "Target user not found"
    );

    error.code =
      "USER_NOT_FOUND";

    throw error;
  }

  return user;
}

function validateDuration(
  durationMonths
) {
  const duration =
    Number(durationMonths);

  if (
    !ALLOWED_DURATIONS.includes(
      duration
    )
  ) {
    const error = new Error(
      "Invalid Pro duration"
    );

    error.code =
      "INVALID_PRO_DURATION";

    throw error;
  }

  return duration;
}

async function activatePro({
  telegramUserId,
  targetTelegramUserId,
  durationMonths,
}) {
  const admin =
    await requireProManagePermission(
      telegramUserId
    );

  const duration =
    validateDuration(
      durationMonths
    );

  const user =
    await getTargetUser(
      targetTelegramUserId
    );

  const now = new Date();

  const activeSubscription =
    await proRepository.getActiveSubscriptionByUserId(
      user.id
    );

  let startsAt = now;

  if (
    activeSubscription &&
    new Date(
      activeSubscription.expires_at
    ) > now
  ) {
    startsAt = new Date(
      activeSubscription.expires_at
    );
  }

  const expiresAt =
    addMonths(
      startsAt,
      duration
    );

  const subscription =
    await proRepository.createSubscription({
      userId: user.id,
      subscriptionId:
        createSubscriptionId(),
      planType:
        `ADMIN_${duration}M`,
      durationMonths:
        duration,
      startsAt,
      expiresAt,
      sourceType: "ADMIN",
      sourceId: admin.user_id,
      price: 0,
      currency: "IRT",
      metadata: {
        action: "ADMIN_ACTIVATION",
        admin_user_id:
          admin.user_id,
        admin_telegram_user_id:
          String(telegramUserId),
      },
    });

  await proRepository.setUserPro({
    userId: user.id,
    isPro: true,
    proExpiresAt: expiresAt,
  });

  return {
    user,
    subscription,
    startsAt,
    expiresAt,
    durationMonths: duration,
  };
}

async function renewPro({
  telegramUserId,
  targetTelegramUserId,
  durationMonths,
}) {
  return activatePro({
    telegramUserId,
    targetTelegramUserId,
    durationMonths,
  });
}

async function disablePro({
  telegramUserId,
  targetTelegramUserId,
}) {
  await requireProManagePermission(
    telegramUserId
  );

  const user =
    await getTargetUser(
      targetTelegramUserId
    );

  await proRepository.setUserPro({
    userId: user.id,
    isPro: false,
    proExpiresAt:
      user.pro_expires_at,
  });

  return proRepository.getUserProStatus(
    user.id
  );
}

async function enablePro({
  telegramUserId,
  targetTelegramUserId,
}) {
  await requireProManagePermission(
    telegramUserId
  );

  const user =
    await getTargetUser(
      targetTelegramUserId
    );

  if (
    !user.pro_expires_at ||
    new Date(
      user.pro_expires_at
    ) <= new Date()
  ) {
    const error = new Error(
      "Pro subscription expired"
    );

    error.code =
      "PRO_EXPIRED";

    throw error;
  }

  await proRepository.setUserPro({
    userId: user.id,
    isPro: true,
    proExpiresAt:
      user.pro_expires_at,
  });

  return proRepository.getUserProStatus(
    user.id
  );
}

async function cancelPro({
  telegramUserId,
  targetTelegramUserId,
}) {
  await requireProManagePermission(
    telegramUserId
  );

  const user =
    await getTargetUser(
      targetTelegramUserId
    );

  const activeSubscription =
    await proRepository.getActiveSubscriptionByUserId(
      user.id
    );

  if (activeSubscription) {
    await proRepository.setSubscriptionStatus({
      subscriptionId:
        activeSubscription.subscription_id,
      status: "CANCELLED",
    });
  }

  await proRepository.setUserPro({
    userId: user.id,
    isPro: false,
    proExpiresAt:
      user.pro_expires_at,
  });

  return proRepository.getUserProStatus(
    user.id
  );
}

async function getProStatus({
  telegramUserId,
  targetTelegramUserId,
}) {
  await requireProManagePermission(
    telegramUserId
  );

  const user =
    await getTargetUser(
      targetTelegramUserId
    );

  return proRepository.getUserProStatus(
    user.id
  );
}

module.exports = {
  requireProManagePermission,
  activatePro,
  renewPro,
  disablePro,
  enablePro,
  cancelPro,
  getProStatus,
  ALLOWED_DURATIONS,
};
