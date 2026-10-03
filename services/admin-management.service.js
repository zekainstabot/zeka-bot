const adminRepository = require("../repositories/admin-management.repository");

async function listAdmins() {
  return adminRepository.listAdmins();
}

async function addAdmin(
  telegramUserId
) {
  const user =
    await adminRepository.findUserByTelegramId(
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

  const existingAdmin =
    await adminRepository.findAdminByUserId(
      user.id
    );

  if (existingAdmin) {
    const error = new Error(
      "User is already an admin"
    );

    error.code =
      "ALREADY_ADMIN";

    throw error;
  }

  return adminRepository.createAdmin(
    user.id
  );
}

async function setAdminActive(
  telegramUserId,
  isActive
) {
  const user =
    await adminRepository.findUserByTelegramId(
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

  const admin =
    await adminRepository.findAdminByUserId(
      user.id
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
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin is protected"
    );

    error.code =
      "SUPER_ADMIN_PROTECTED";

    throw error;
  }

  return adminRepository.setAdminActive(
    user.id,
    isActive
  );
}

async function removeAdmin(
  telegramUserId
) {
  const user =
    await adminRepository.findUserByTelegramId(
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

  const admin =
    await adminRepository.findAdminByUserId(
      user.id
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
    admin.role_key ===
    "super_admin"
  ) {
    const error = new Error(
      "Super Admin is protected"
    );

    error.code =
      "SUPER_ADMIN_PROTECTED";

    throw error;
  }

  return adminRepository.removeAdmin(
    user.id
  );
}

module.exports = {
  listAdmins,
  addAdmin,
  setAdminActive,
  removeAdmin,
};
