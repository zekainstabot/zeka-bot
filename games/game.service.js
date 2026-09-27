const gameRepository = require("../repositories/game.repository");
const gameSettingsService = require("./game-settings.service");
const {
  reserveGameCredit,
  consumeGameCredit,
  releaseGameCredit,
} = require("../services/credit.service");

function generateSessionKey(gameKey, userId) {
  const timestamp = Date.now().toString(36);
  const random = Math.random()
    .toString(36)
    .slice(2, 12);

  return `${gameKey}-${userId}-${timestamp}-${random}`
    .slice(0, 64);
}

async function getGameType(gameKey) {
  if (!gameKey) {
    throw new Error("Game key is required");
  }

  const gameType =
    await gameSettingsService
      .getGameTypeByKey(gameKey);

  if (!gameType) {
    throw new Error(
      `Game type not found: ${gameKey}`
    );
  }

  return gameType;
}

async function assertGameEnabled(gameTypeId) {
  const enabled =
    await gameSettingsService.isGameEnabled(
      gameTypeId
    );

  if (!enabled) {
    throw new Error("Game is currently disabled");
  }

  return true;
}

async function getGameCost(gameTypeId) {
  const cost =
    await gameSettingsService.getGameCost(
      gameTypeId
    );

  const numericCost = Number(cost);

  if (
    !Number.isFinite(numericCost) ||
    numericCost < 0
  ) {
    throw new Error(
      `Invalid game cost: ${cost}`
    );
  }

  return numericCost;
}

async function startGame({
  userId,
  gameKey,
  totalRounds = 1,
  metadata = {},
  expiresAt = null,
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!gameKey) {
    throw new Error("Game key is required");
  }

  if (
    !Number.isInteger(totalRounds) ||
    totalRounds <= 0
  ) {
    throw new Error(
      "Total rounds must be a positive integer"
    );
  }

  const gameType =
    await getGameType(gameKey);

  await assertGameEnabled(gameType.id);

  const cost =
    await getGameCost(gameType.id);

  const sessionKey =
    generateSessionKey(
      gameKey,
      userId
    );

  const session =
    await gameRepository.createSession({
      sessionKey,
      gameTypeId: gameType.id,
      userId,
      status: "WAITING",
      entryCost: cost,
      reservedCost: 0,
      currentRound: 0,
      totalRounds,
      metadata,
      expiresAt,
    });

  try {
    await reserveGameCredit({
      userId,
      amount: cost,
      gameSessionId: session.id,
    });

    const updatedSession =
      await gameRepository.updateSession(
        session.id,
        {
          status: "ACTIVE",
          reserved_cost: cost,
          started_at: new Date(),
        }
      );

    return updatedSession || session;
  } catch (error) {
    try {
      await gameRepository.updateSession(
        session.id,
        {
          status: "CANCELLED",
          result: {
            error: error.message,
          },
          completed_at: new Date(),
        }
      );
    } catch (updateError) {
      console.error(
        "Failed to cancel game session:",
        updateError
      );
    }

    throw error;
  }
}

async function completeGame(
  gameSessionId,
  result = {}
) {
  if (!gameSessionId) {
    throw new Error(
      "Game session ID is required"
    );
  }

  const session =
    await gameRepository.findSessionById(
      gameSessionId
    );

  if (!session) {
    throw new Error(
      `Game session not found: ${gameSessionId}`
    );
  }

  if (session.status === "COMPLETED") {
    return session;
  }

  if (session.status === "CANCELLED") {
    throw new Error(
      "Game session is already cancelled"
    );
  }

  await consumeGameCredit(
    gameSessionId
  );

  const updatedSession =
    await gameRepository.updateSession(
      gameSessionId,
      {
        status: "COMPLETED",
        result,
        completed_at: new Date(),
      }
    );

  return updatedSession || session;
}

async function cancelGame(
  gameSessionId,
  reason = null
) {
  if (!gameSessionId) {
    throw new Error(
      "Game session ID is required"
    );
  }

  const session =
    await gameRepository.findSessionById(
      gameSessionId
    );

  if (!session) {
    throw new Error(
      `Game session not found: ${gameSessionId}`
    );
  }

  if (session.status === "COMPLETED") {
    throw new Error(
      "Completed game cannot be cancelled"
    );
  }

  if (session.status === "CANCELLED") {
    return session;
  }

  await releaseGameCredit(
    gameSessionId
  );

  const updatedSession =
    await gameRepository.updateSession(
      gameSessionId,
      {
        status: "CANCELLED",
        result: {
          cancelled: true,
          reason,
        },
        completed_at: new Date(),
      }
    );

  return updatedSession || session;
}

async function getGameSession(
  gameSessionId
) {
  if (!gameSessionId) {
    throw new Error(
      "Game session ID is required"
    );
  }

  return gameRepository.findSessionById(
    gameSessionId
  );
}

module.exports = {
  getGameType,
  assertGameEnabled,
  getGameCost,
  startGame,
  completeGame,
  cancelGame,
  getGameSession,
};
