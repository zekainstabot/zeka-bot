const adminRepository = require("../repositories/admin.repository");

async function getAdminByUserId(userId) {
  return adminRepository.findByUserId(userId);
}

async function getAdminByTelegramId(telegramUserId) {
  return adminRepository.findByTelegramId(telegramUserId);
}

async function isAdmin(userId) {
  return adminRepository.isAdmin(userId);
}

async function isAdminByTelegramId(telegramUserId) {
  return adminRepository.isAdminByTelegramId(telegramUserId);
}

async function hasPermission(userId, permissionKey) {
  if (!userId || !permissionKey) {
    return false;
  }

  return adminRepository.hasPermission(
    userId,
    permissionKey
  );
}

async function requirePermission(userId, permissionKey) {
  const admin = await getAdminByUserId(userId);

  if (!admin || !admin.is_active) {
    const error = new Error("Admin access denied");
    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  const allowed = await hasPermission(
    userId,
    permissionKey
  );

  if (!allowed) {
    const error = new Error(
      `Permission denied: ${permissionKey}`
    );

    error.code = "PERMISSION_DENIED";
    error.permission = permissionKey;

    throw error;
  }

  return admin;
}

async function createAdmin({
  userId,
  roleKey = "admin",
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return adminRepository.create({
    userId,
    roleKey,
  });
}

async function setAdminActive(userId, isActive) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return adminRepository.setActive(
    userId,
    isActive
  );
}

async function updateLastLogin(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return adminRepository.updateLastLogin(userId);
}

async function getPermissions(userId) {
  if (!userId) {
    return [];
  }

  return adminRepository.getPermissionsByUserId(
    userId
  );
}

module.exports = {
  getAdminByUserId,
  getAdminByTelegramId,
  isAdmin,
  isAdminByTelegramId,
  hasPermission,
  requirePermission,
  createAdmin,
  setAdminActive,
  updateLastLogin,
  getPermissions,
};
