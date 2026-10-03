const USER_COMMANDS = [
  {
    command: "start",
    description: "شروع کار با زکا",
  },
  {
    command: "help",
    description: "راهنمای زکا",
  },
];

const ADMIN_COMMANDS = [
  ...USER_COMMANDS,
  {
    command: "admin",
    description: "پنل ادمین",
  },
];

const SUPER_ADMIN_COMMANDS = [
  ...USER_COMMANDS,
  {
    command: "superadmin",
    description: "پنل Super Admin",
  },
];

async function setUserCommands(
  telegram,
  telegramUserId,
  role = "user"
) {
  if (!telegram || !telegramUserId) {
    return;
  }

  let commands = USER_COMMANDS;

  if (role === "admin") {
    commands = ADMIN_COMMANDS;
  }

  if (role === "super_admin") {
    commands = SUPER_ADMIN_COMMANDS;
  }

  await telegram.setMyCommands(
    commands,
    {
      scope: {
        type: "chat",
        chat_id: telegramUserId,
      },
    }
  );
}

module.exports = {
  setUserCommands,
};
