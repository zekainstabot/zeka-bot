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
  return adminRepository.isAdminByTelegramId(
    telegramUserId
  );
}

async function hasPermission(
  userId,
  permissionKey
) {
  if (!userId || !permissionKey) {
    return false;
  }

  const admin =
    await adminRepository.findByUserId(
      userId
    );

  if (!admin || !admin.is_active) {
    return false;
  }

  if (admin.role_key === "super_admin") {
    return true;
  }

  return adminRepository.hasPermission(
    userId,
    permissionKey
  );
}

async function requirePermission(
  userId,
  permissionKey
) {
  const admin =
    await getAdminByUserId(userId);

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
    admin.role_key === "super_admin"
  ) {
    return admin;
  }

  const allowed =
    await hasPermission(
      userId,
      permissionKey
    );

  if (!allowed) {
    const error = new Error(
      `Permission denied: ${permissionKey}`
    );

    error.code =
      "PERMISSION_DENIED";

    error.permission =
      permissionKey;

    throw error;
  }

  return admin;
}

async function createAdmin({
  userId,
  roleKey = "admin",
}) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  return adminRepository.create({
    userId,
    roleKey,
  });
}

async function setAdminActive(
  userId,
  isActive
) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  return adminRepository.setActive(
    userId,
    isActive
  );
}

async function updateLastLogin(
  userId
) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  return adminRepository.updateLastLogin(
    userId
  );
}

async function getPermissions(
  userId
) {
  if (!userId) {
    return [];
  }

  return adminRepository.getPermissionsByUserId(
    userId
  );
}

async function getAllPermissions() {
  return adminRepository.getAllPermissions();
}

async function getDirectPermissions(
  userId
) {
  if (!userId) {
    return [];
  }

  return adminRepository.getDirectPermissionsByUserId(
    userId
  );
}

async function getPermissionOverride(
  userId,
  permissionKey
) {
  if (!userId || !permissionKey) {
    return null;
  }

  return adminRepository.getPermissionOverride(
    userId,
    permissionKey
  );
}

async function getPermissionOverrides(
  userId
) {
  if (!userId) {
    return [];
  }

  return adminRepository.getPermissionOverridesByUserId(
    userId
  );
}

async function setPermissionOverride(
  userId,
  permissionKey,
  isEnabled
) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  if (!permissionKey) {
    throw new Error(
      "Permission key is required"
    );
  }

  const admin =
    await adminRepository.findByUserId(
      userId
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code =
      "ADMIN_NOT_FOUND";

    throw error;
  }

  if (
    admin.role_key === "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code =
      "SUPER_ADMIN_PROTECTED";

    throw error;
  }

  const permissions =
    await adminRepository.getAllPermissions();

  const exists =
    permissions.some(
      (item) =>
        item.permission_key ===
        permissionKey
    );

  if (!exists) {
    const error = new Error(
      "Permission not found"
    );

    error.code =
      "PERMISSION_NOT_FOUND";

    throw error;
  }

  return adminRepository.setPermissionOverride(
    userId,
    permissionKey,
    isEnabled
  );
}

async function resetPermissionOverride(
  userId,
  permissionKey
) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  if (!permissionKey) {
    throw new Error(
      "Permission key is required"
    );
  }

  const admin =
    await adminRepository.findByUserId(
      userId
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code =
      "ADMIN_NOT_FOUND";

    throw error;
  }

  if (
    admin.role_key === "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code =
      "SUPER_ADMIN_PROTECTED";

    throw error;
  }

  return adminRepository.removePermissionOverride(
    userId,
    permissionKey
  );
}

async function addPermission(
  userId,
  permissionKey
) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  if (!permissionKey) {
    throw new Error(
      "Permission key is required"
    );
  }

  const admin =
    await adminRepository.findByUserId(
      userId
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code =
      "ADMIN_NOT_FOUND";

    throw error;
  }

  if (
    admin.role_key === "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code =
      "SUPER_ADMIN_PROTECTED";

    throw error;
  }

  const permissions =
    await adminRepository.getAllPermissions();

  const exists =
    permissions.some(
      (item) =>
        item.permission_key ===
        permissionKey
    );

  if (!exists) {
    const error = new Error(
      "Permission not found"
    );

    error.code =
      "PERMISSION_NOT_FOUND";

    throw error;
  }

  return adminRepository.addDirectPermission(
    userId,
    permissionKey
  );
}

async function removePermission(
  userId,
  permissionKey
) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  if (!permissionKey) {
    throw new Error(
      "Permission key is required"
    );
  }

  const admin =
    await adminRepository.findByUserId(
      userId
    );

  if (!admin) {
    const error = new Error(
      "Admin not found"
    );

    error.code =
      "ADMIN_NOT_FOUND";

    throw error;
  }

  if (
    admin.role_key === "super_admin"
  ) {
    const error = new Error(
      "Super Admin permissions cannot be modified"
    );

    error.code =
      "SUPER_ADMIN_PROTECTED";

    throw error;
  }

  return adminRepository.removeDirectPermission(
    userId,
    permissionKey
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
  getAllPermissions,
  getDirectPermissions,

  getPermissionOverride,
  getPermissionOverrides,
  setPermissionOverride,
  resetPermissionOverride,

  addPermission,
  removePermission,
};
