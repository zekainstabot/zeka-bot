const { getPool } = require("../database/pool");
const gameRepository = require("../repositories/game.repository");
const gameSettingsService = require("./game-settings.service");
const rewardService = require("./reward.service");
const {
  reserveGameCredit,
  consumeGameCreditInTransaction,
  releaseGameCredit,
} = require("../services/credit.service");

function generateSessionKey(
  gameKey,
  userId
) {
  const timestamp =
    Date.now().toString(36);

  const random =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `${gameKey}-${userId}-${timestamp}-${random}`.slice(
    0,
    64
  );
}

async function getGameType(gameKey) {
  if (!gameKey) {
    throw new Error(
      "Game key is required"
    );
  }

  const gameType =
    await gameSettingsService.getGameTypeByKey(
      gameKey
    );

  if (!gameType) {
    throw new Error(
      `Game type not found: ${gameKey}`
    );
  }

  return gameType;
}

async function assertGameEnabled(
  gameTypeId
) {
  const enabled =
    await gameSettingsService.isGameEnabled(
      gameTypeId
    );

  if (!enabled) {
    throw new Error(
      "Game is currently disabled"
    );
  }

  return true;
}

async function getGameCost(
  gameTypeId
) {
  const cost =
    await gameSettingsService.getGameCost(
      gameTypeId
    );

  const numericCost =
    Number(cost);

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
    throw new Error(
      "User ID is required"
    );
  }

  if (!gameKey) {
    throw new Error(
      "Game key is required"
    );
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

  await assertGameEnabled(
    gameType.id
  );

  const cost =
    await getGameCost(
      gameType.id
    );

  const sessionKey =
    generateSessionKey(
      gameKey,
      userId
    );

  const session =
    await gameRepository.createSession({
      sessionKey,
      gameTypeId:
        gameType.id,
      userId,
      status: "WAITING",
      entryCost: cost,
      reservedCost: 0,
      currentRound: 0,
      totalRounds,
      metadata,
      expiresAt,
    });

  let creditReserved = false;

  try {
    await reserveGameCredit({
      userId,
      amount: cost,
      gameSessionId:
        session.id,
    });

    creditReserved = true;

    const updatedSession =
      await gameRepository.updateSession(
        session.id,
        {
          status: "ACTIVE",
          reserved_cost: cost,
          started_at:
            new Date(),
        }
      );

    return (
      updatedSession ||
      session
    );
  } catch (error) {
    if (creditReserved) {
      try {
        await releaseGameCredit(
          session.id
        );
      } catch (
        releaseError
      ) {
        console.error(
          `Failed to release game credit for session ${session.id}:`,
          releaseError
        );
      }
    }

    try {
      await gameRepository.updateSession(
        session.id,
        {
          status: "FAILED",
          result: {
            error:
              error.message,
          },
          completed_at:
            new Date(),
        }
      );
    } catch (
      updateError
    ) {
      console.error(
        "Failed to mark game session as FAILED:",
        updateError
      );
    }

    throw error;
  }
}

async function completeGame(
  gameSessionId,
  result = {},
  reward = null
) {
  if (!gameSessionId) {
    throw new Error(
      "Game session ID is required"
    );
  }

  const pool =
    getPool();

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const session =
      await gameRepository.findSessionByIdForUpdate(
        gameSessionId,
        client
      );

    if (!session) {
      throw new Error(
        `Game session not found: ${gameSessionId}`
      );
    }

    if (
      session.status ===
      "COMPLETED"
    ) {
      await client.query(
        "COMMIT"
      );

      return session;
    }

    if (
      session.status ===
        "CANCELLED" ||
      session.status ===
        "FAILED"
    ) {
      throw new Error(
        "Game session is not active"
      );
    }

    await consumeGameCreditInTransaction(
      gameSessionId,
      client
    );

    let rewardResult =
      null;

    if (reward) {
      rewardResult =
        await rewardService.grantRewardInTransaction(
          {
            userId:
              session.user_id,

            rewardType:
              reward.rewardType,

            sourceType:
              reward.sourceType ||
              "GAME",

            sourceId:
              reward.sourceId ||
              gameSessionId,

            creditAmount:
              reward.creditAmount ||
              0,

            xpAmount:
              reward.xpAmount ||
              0,

            proDays:
              reward.proDays ||
              0,

            metadata:
              reward.metadata ||
              {},

            client,
          }
        );
    }

    const finalResult = {
      ...result,

      reward:
        rewardResult
          ? {
              granted:
                rewardResult.granted,

              duplicate:
                rewardResult.duplicate ||
                false,

              creditAmount:
                rewardResult.creditAmount ||
                0,

              xpAmount:
                rewardResult.xpAmount ||
                0,

              proDays:
                rewardResult.proDays ||
                0,
            }
          : null,
    };

    const updatedSession =
      await gameRepository.updateSession(
        gameSessionId,
        {
          status:
            "COMPLETED",

          result:
            finalResult,

          completed_at:
            new Date(),
        },
        client
      );

    await client.query(
      "COMMIT"
    );

    return (
      updatedSession || {
        ...session,
        status:
          "COMPLETED",
        result:
          finalResult,
      }
    );
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (
      rollbackError
    ) {
      console.error(
        `Failed to rollback game completion for session ${gameSessionId}:`,
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
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

  if (
    session.status ===
    "COMPLETED"
  ) {
    throw new Error(
      "Completed game cannot be cancelled"
    );
  }

  if (
    session.status ===
    "CANCELLED"
  ) {
    return session;
  }

  if (
    session.status ===
    "FAILED"
  ) {
    return session;
  }

  await releaseGameCredit(
    gameSessionId
  );

  const updatedSession =
    await gameRepository.updateSession(
      gameSessionId,
      {
        status:
          "CANCELLED",

        result: {
          cancelled: true,
          reason,
        },

        completed_at:
          new Date(),
      }
    );

  return (
    updatedSession ||
    session
  );
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
