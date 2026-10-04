const adminManagementRepository = require(
  "../repositories/admin-management.repository"
);

const adminRepository = require(
  "../repositories/admin.repository"
);

async function listAdmins() {
  return adminManagementRepository.listAdmins();
}

async function getRoles() {
  return adminManagementRepository.listRoles();
}

async function getAdminAccess(
  telegramUserId
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  const permissions =
    await adminManagementRepository.getAdminPermissions(
      user.id
    );

  const directPermissions =
    await adminManagementRepository.getDirectPermissions(
      user.id
    );

  const overrides =
    await adminManagementRepository.getPermissionOverrides(
      user.id
    );

  return {
    user,
    admin,
    permissions,
    directPermissions,
    overrides,
  };
}

async function requirePermissionByTelegramId(
  telegramUserId,
  permissionKey
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (
    !admin ||
    !admin.is_active
  ) {
    const error = new Error(
      "Admin access denied"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  if (
    admin.role_key ===
    "super_admin"
  ) {
    return admin;
  }

  const allowed =
    await adminRepository.hasPermission(
      user.id,
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

async function getAllPermissions() {
  return adminManagementRepository.getAllPermissions();
}

async function getDirectPermissions(
  telegramUserId
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  return adminManagementRepository.getDirectPermissions(
    user.id
  );
}

/*
 * دریافت تمام دسترسی‌ها همراه با وضعیت مؤثر
 *
 * این تابع برای UI مدیریت دسترسی استفاده می‌شود.
 */
async function getPermissionMatrix(
  telegramUserId
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  return {
    user,
    admin,
    permissions:
      await adminManagementRepository.getAdminPermissions(
        user.id
      ),
  };
}

/*
 * تغییر وضعیت Override
 *
 * true  = اجباراً فعال
 * false = اجباراً غیرفعال
 */
async function setPermissionOverride(
  telegramUserId,
  permissionKey,
  isEnabled
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code = "SUPER_ADMIN_REQUIRED";
    throw error;
  }

  if (
    typeof permissionKey !==
      "string" ||
    !permissionKey.trim()
  ) {
    const error = new Error(
      "Invalid permission key"
    );

    error.code = "INVALID_PERMISSION";
    throw error;
  }

  return adminManagementRepository.setPermissionOverride(
    user.id,
    permissionKey.trim(),
    Boolean(isEnabled)
  );
}

/*
 * حذف Override
 *
 * بعد از این کار دسترسی دوباره
 * از Role / Direct Permission محاسبه می‌شود.
 *
 * یعنی حالت ⚪ پیش‌فرض
 */
async function resetPermissionOverride(
  telegramUserId,
  permissionKey
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code = "SUPER_ADMIN_REQUIRED";
    throw error;
  }

  if (
    typeof permissionKey !==
      "string" ||
    !permissionKey.trim()
  ) {
    const error = new Error(
      "Invalid permission key"
    );

    error.code = "INVALID_PERMISSION";
    throw error;
  }

  return adminManagementRepository.removePermissionOverride(
    user.id,
    permissionKey.trim()
  );
}

/*
 * Legacy:
 * افزودن Direct Permission
 *
 * فعلاً نگه داشته شده تا بخش‌های قدیمی
 * پنل از کار نیفتند.
 */
async function addPermission(
  telegramUserId,
  permissionKey
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code = "SUPER_ADMIN_REQUIRED";
    throw error;
  }

  return adminManagementRepository.addDirectPermission(
    user.id,
    permissionKey
  );
}

/*
 * Legacy:
 * حذف Direct Permission
 */
async function removePermission(
  telegramUserId,
  permissionKey
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code = "SUPER_ADMIN_REQUIRED";
    throw error;
  }

  return adminManagementRepository.removeDirectPermission(
    user.id,
    permissionKey
  );
}

async function changeAdminRole(
  telegramUserId,
  roleKey
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin role cannot be changed"
    );

    error.code = "SUPER_ADMIN_REQUIRED";
    throw error;
  }

  if (
    roleKey ===
    "super_admin"
  ) {
    const error = new Error(
      "Cannot assign Super Admin role"
    );

    error.code = "SUPER_ADMIN_REQUIRED";
    throw error;
  }

  return adminManagementRepository.setAdminRole(
    user.id,
    roleKey
  );
}

async function addAdmin(
  telegramUserId
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const existing =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (existing) {
    const error = new Error(
      "User is already an admin"
    );

    error.code = "ALREADY_ADMIN";
    throw error;
  }

  return adminManagementRepository.createAdmin(
    user.id
  );
}

async function setAdminActive(
  telegramUserId,
  isActive
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin cannot be disabled"
    );

    error.code = "SUPER_ADMIN_REQUIRED";
    throw error;
  }

  return adminManagementRepository.setAdminActive(
    user.id,
    isActive
  );
}

async function removeAdmin(
  telegramUserId
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin cannot be removed"
    );

    error.code = "SUPER_ADMIN_REQUIRED";
    throw error;
  }

  return adminManagementRepository.removeAdmin(
    user.id
  );
}

async function setReportAdmin(
  telegramUserId
) {
  const user =
    await adminManagementRepository.findUserByTelegramId(
      telegramUserId
    );

  if (!user) {
    const error = new Error(
      "User not found"
    );

    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const admin =
    await adminManagementRepository.findAdminByUserId(
      user.id
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code = "ADMIN_ACCESS_DENIED";
    throw error;
  }

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin cannot be selected as report admin"
    );

    error.code = "SUPER_ADMIN_REQUIRED";
    throw error;
  }

  const {
    setSetting,
  } = require(
    "./settings.service"
  );

  await setSetting(
    "support.report_admin_id",
    String(user.id)
  );

  return true;
}

module.exports = {
  listAdmins,
  getRoles,

  getAdminAccess,
  requirePermissionByTelegramId,

  getAllPermissions,
  getDirectPermissions,

  getPermissionMatrix,

  setPermissionOverride,
  resetPermissionOverride,

  // Legacy
  addPermission,
  removePermission,

  changeAdminRole,
  addAdmin,
  setAdminActive,
  removeAdmin,

  setReportAdmin,
};
