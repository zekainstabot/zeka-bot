const { initializeDatabase } = require("../database/bootstrap");
const { getClient, close } = require("../database/client");

async function main() {
  const telegramUserId = Number(
    process.env.SUPER_ADMIN_TELEGRAM_ID
  );

  if (
    !Number.isSafeInteger(telegramUserId) ||
    telegramUserId <= 0
  ) {
    throw new Error(
      "SUPER_ADMIN_TELEGRAM_ID is not configured correctly"
    );
  }

  await initializeDatabase();

  const db = getClient();

  const userResult = await db.query(
    `
      SELECT id, telegram_user_id
      FROM users
      WHERE telegram_user_id = $1
      LIMIT 1
    `,
    [telegramUserId]
  );

  const user = userResult.rows[0];

  if (!user) {
    throw new Error(
      "Telegram user not found. Start the bot with this account first."
    );
  }

  const roleResult = await db.query(
    `
      SELECT id
      FROM admin_roles
      WHERE role_key = 'super_admin'
      LIMIT 1
    `
  );

  const role = roleResult.rows[0];

  if (!role) {
    throw new Error(
      "super_admin role does not exist"
    );
  }

  const adminResult = await db.query(
    `
      INSERT INTO admins (
        user_id,
        role_id,
        is_active
      )
      VALUES ($1, $2, TRUE)
      ON CONFLICT (user_id)
      DO UPDATE SET
        role_id = EXCLUDED.role_id,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING *
    `,
    [user.id, role.id]
  );

  const admin = adminResult.rows[0];

  console.log(
    `Super admin configured successfully for Telegram user ${telegramUserId}.`
  );

  console.log(
    `Admin ID: ${admin.id}`
  );
}

main()
  .catch((error) => {
    console.error(
      "Failed to create super admin:"
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await close();
    } catch {}
  });
