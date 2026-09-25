const http = require("http");

const { initializeDatabase } = require("./database/bootstrap");
const { getClient } = require("./database/client");
const { startBot } = require("./bot");

const PORT = Number(process.env.PORT) || 10000;

function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
      });

      res.end("Zeka Bot is running");
      return;
    }

    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
    });

    res.end("Not Found");
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP server running on port ${PORT}`);
  });

  return server;
}

async function setupSuperAdmin() {
  const telegramUserId = Number(
    process.env.SUPER_ADMIN_TELEGRAM_ID
  );

  if (
    !Number.isSafeInteger(telegramUserId) ||
    telegramUserId <= 0
  ) {
    console.log(
      "SUPER_ADMIN_TELEGRAM_ID is not configured. Skipping super admin setup."
    );
    return;
  }

  const db = getClient();

  const userResult = await db.query(
    `
      SELECT id
      FROM users
      WHERE telegram_user_id = $1
      LIMIT 1
    `,
    [telegramUserId]
  );

  const user = userResult.rows[0];

  if (!user) {
    console.log(
      "Super admin user was not found. Start the bot with the configured Telegram account first."
    );
    return;
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

  await db.query(
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
    `,
    [user.id, role.id]
  );

  console.log("Super admin setup completed.");
}

async function start() {
  console.log("Zeka Bot starting...");

  try {
    startHealthServer();

    await initializeDatabase();

    console.log("Zeka Bot database initialized.");

    await setupSuperAdmin();

    await startBot();
  } catch (error) {
    console.error("Failed to start Zeka Bot.");
    console.error(error);

    process.exitCode = 1;
  }
}

start();
