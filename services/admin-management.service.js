const adminManagementRepository = require(
  "../repositories/admin-management.repository"
);

const adminRepository = require(
  "../repositories/admin.repository"
);

const PERMISSION_ALIASES = {
  "users.view": "users",
  "users.manage": "users",
  "settings.view": "settings",
  "settings.manage": "settings",
  "requests.view": "requests",
  "requests.manage": "requests",
  "credits.view": "credits",
  "credits.manage": "credits",
  "rewards.view": "rewards",
  "rewards.manage": "rewards",
  "platforms.view": "platforms",
  "platforms.manage": "platforms",
  "features.view": "features",
  "features.manage": "features",
  "support.view": "support",
  "support.manage": "support",
  "monitoring.view": "monitoring",
  "admins.view": "admins",
  "admins.manage": "admins",
  "reports.view": "reports",
  "reports.manage": "reports",
  "games.quiz.manage": "games.quiz",
  "pro.manage": "pro",
};

function normalizePermissionKey(
  permissionKey
) {
  if (
    typeof permissionKey !== "string" ||
    !permissionKey.trim()
  ) {
    return null;
  }

  const key = permissionKey.trim();

  return (
    PERMISSION_ALIASES[key] ||
    key
  );
}

async function getUserAndAdmin(
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

    error.code =
      "ADMIN_ACCESS_DENIED";

    throw error;
  }

  return {
    user,
    admin,
  };
}

async function listAdmins() {
  return adminManagementRepository.listAdmins();
}

async function getRoles() {
  return adminManagementRepository.listRoles();
}

async function getAdminAccess(
  telegramUserId
) {
  const {
    user,
    admin,
  } = await getUserAndAdmin(
    telegramUserId
  );

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
  const {
    user,
    admin,
  } = await getUserAndAdmin(
    telegramUserId
  );

  if (!admin.is_active) {
    const error = new Error(
      "Admin access denied"
    );

    error.code =
      "ADMIN_ACCESS_DENIED";

    throw error;
  }

  if (
    admin.role_key ===
    "super_admin"
  ) {
    return admin;
  }

  const normalizedKey =
    normalizePermissionKey(
      permissionKey
    );

  if (!normalizedKey) {
    const error = new Error(
      "Permission key is required"
    );

    error.code =
      "PERMISSION_DENIED";

    throw error;
  }

  const allowed =
    await adminRepository.hasPermission(
      user.id,
      normalizedKey
    );

  if (!allowed) {
    const error = new Error(
      `Permission denied: ${normalizedKey}`
    );

    error.code =
      "PERMISSION_DENIED";

    error.permission =
      normalizedKey;

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
  const {
    user,
  } = await getUserAndAdmin(
    telegramUserId
  );

  return adminManagementRepository.getDirectPermissions(
    user.id
  );
}

async function getPermissionMatrix(
  telegramUserId
) {
  const {
    user,
    admin,
  } = await getUserAndAdmin(
    telegramUserId
  );

  return {
    user,
    admin,
    permissions:
      await adminManagementRepository.getAdminPermissions(
        user.id
      ),
  };
}

async function validateEditablePermission(
  permissionKey
) {
  const normalizedKey =
    normalizePermissionKey(
      permissionKey
    );

  if (!normalizedKey) {
    const error = new Error(
      "Invalid permission key"
    );

    error.code =
      "INVALID_PERMISSION";

    throw error;
  }

  const permissions =
    await adminManagementRepository.getAllPermissions();

  const exists =
    permissions.some(
      (permission) =>
        permission.permission_key ===
        normalizedKey
    );

  if (!exists) {
    const error = new Error(
      "Permission not found"
    );

    error.code =
      "PERMISSION_NOT_FOUND";

    throw error;
  }

  return normalizedKey;
}

async function setPermissionOverride(
  telegramUserId,
  permissionKey,
  isEnabled
) {
  const {
    user,
    admin,
  } = await getUserAndAdmin(
    telegramUserId
  );

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code =
      "SUPER_ADMIN_REQUIRED";

    throw error;
  }

  const normalizedKey =
    await validateEditablePermission(
      permissionKey
    );

  return adminManagementRepository.setPermissionOverride(
    user.id,
    normalizedKey,
    Boolean(isEnabled)
  );
}

async function resetPermissionOverride(
  telegramUserId,
  permissionKey
) {
  const {
    user,
    admin,
  } = await getUserAndAdmin(
    telegramUserId
  );

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code =
      "SUPER_ADMIN_REQUIRED";

    throw error;
  }

  const normalizedKey =
    await validateEditablePermission(
      permissionKey
    );

  return adminManagementRepository.removePermissionOverride(
    user.id,
    normalizedKey
  );
}

async function addPermission(
  telegramUserId,
  permissionKey
) {
  const {
    user,
    admin,
  } = await getUserAndAdmin(
    telegramUserId
  );

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code =
      "SUPER_ADMIN_REQUIRED";

    throw error;
  }

  const normalizedKey =
    await validateEditablePermission(
      permissionKey
    );

  return adminManagementRepository.addDirectPermission(
    user.id,
    normalizedKey
  );
}

async function removePermission(
  telegramUserId,
  permissionKey
) {
  const {
    user,
    admin,
  } = await getUserAndAdmin(
    telegramUserId
  );

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code =
      "SUPER_ADMIN_REQUIRED";

    throw error;
  }

  const normalizedKey =
    await validateEditablePermission(
      permissionKey
    );

  return adminManagementRepository.removeDirectPermission(
    user.id,
    normalizedKey
  );
}

async function changeAdminRole(
  telegramUserId,
  roleKey
) {
  const {
    user,
    admin,
  } = await getUserAndAdmin(
    telegramUserId
  );

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin role cannot be changed"
    );

    error.code =
      "SUPER_ADMIN_REQUIRED";

    throw error;
  }

  if (
    roleKey ===
    "super_admin"
  ) {
    const error = new Error(
      "Cannot assign Super Admin role"
    );

    error.code =
      "SUPER_ADMIN_REQUIRED";

    throw error;
  }

  const roles =
    await adminManagementRepository.listRoles();

  const roleExists =
    roles.some(
      (role) =>
        role.role_key ===
        roleKey
    );

  if (!roleExists) {
    const error = new Error(
      "Role not found"
    );

    error.code =
      "ROLE_NOT_FOUND";

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

    error.code =
      "USER_NOT_FOUND";

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

    error.code =
      "ALREADY_ADMIN";

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
  const {
    user,
    admin,
  } = await getUserAndAdmin(
    telegramUserId
  );

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin cannot be disabled"
    );

    error.code =
      "SUPER_ADMIN_REQUIRED";

    throw error;
  }

  return adminManagementRepository.setAdminActive(
    user.id,
    Boolean(isActive)
  );
}

async function removeAdmin(
  telegramUserId
) {
  const {
    user,
    admin,
  } = await getUserAndAdmin(
    telegramUserId
  );

  if (
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin cannot be removed"
    );

    error.code =
      "SUPER_ADMIN_REQUIRED";

    throw error;
  }

  return adminManagementRepository.removeAdmin(
    user.id
  );
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

  addPermission,
  removePermission,

  changeAdminRole,
  addAdmin,
  setAdminActive,
  removeAdmin,

  setReportAdmin,
};
