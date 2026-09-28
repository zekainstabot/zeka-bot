const creditService = require("../services/credit.service");
const rewardService = require("../services/reward.service");
const gameSettingsService = require("./game-settings.service");
const gameRepository = require("../repositories/game.repository");
const { getPool } = require("../database/pool");

function generateSessionKey(gameKey, userId) {
  return `${gameKey}_${userId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

async function getGameType(gameKey) {
  if (!gameKey) {
    throw new Error("Game key is required");
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

async function getGameSession(sessionId) {
  if (!sessionId) {
    throw new Error("Game session ID is required");
  }

  return gameRepository.findSessionById(
    sessionId
  );
}

async function startGame({
  userId,
  gameTypeId = null,
  gameKey = null,
  cost = null,
  totalRounds = 1,
  metadata = {},
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  let gameType = null;

  if (gameKey) {
    gameType = await getGameType(gameKey);
    gameTypeId = gameType.id;
  }

  if (!gameTypeId) {
    throw new Error("Game type ID is required");
  }

  let entryCost = Number(cost);

  if (
    !Number.isFinite(entryCost) ||
    entryCost <= 0
  ) {
    if (gameType) {
      entryCost = Number(
        gameType.entry_cost || 1
      );
    } else {
      entryCost = 1;
    }
  }

  const sessionKey = generateSessionKey(
    gameKey || `game_${gameTypeId}`,
    userId
  );

  const session =
    await gameRepository.createSession({
      sessionKey,
      gameTypeId,
      userId,
      status: "WAITING",
      entryCost,
      reservedCost: 0,
      currentRound: 0,
      totalRounds,
      metadata,
    });

  try {
    await creditService.reserveGameCredit({
      userId,
      amount: entryCost,
      gameSessionId: session.id,
    });

    const activeSession =
      await gameRepository.updateSession(
        session.id,
        {
          status: "ACTIVE",
          reserved_cost: entryCost,
          started_at: new Date(),
        }
      );

    return activeSession;
  } catch (error) {
    try {
      await gameRepository.updateSession(
        session.id,
        {
          status: "FAILED",
        }
      );
    } catch (statusError) {
      console.error(
        "Failed to mark game session as FAILED:",
        statusError
      );
    }

    throw error;
  }
}

async function completeGame(
  sessionOrOptions,
  result = null,
  reward = null
) {
  let sessionId;
  let gameResult;
  let gameReward;

  if (
    sessionOrOptions &&
    typeof sessionOrOptions === "object"
  ) {
    sessionId =
      sessionOrOptions.sessionId;

    gameResult =
      sessionOrOptions.result || null;

    gameReward =
      sessionOrOptions.reward || null;
  } else {
    sessionId = sessionOrOptions;
    gameResult = result;
    gameReward = reward;
  }

  if (!sessionId) {
    throw new Error(
      "Game session ID is required"
    );
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const session =
      await gameRepository.findSessionByIdForUpdate(
        sessionId,
        client
      );

    if (!session) {
      throw new Error(
        "Game session not found"
      );
    }

    if (
      session.status === "COMPLETED"
    ) {
      await client.query("COMMIT");
      return session;
    }

    if (
      session.status === "CANCELLED" ||
      session.status === "FAILED"
    ) {
      throw new Error(
        `Cannot complete game session with status ${session.status}`
      );
    }

    await creditService.consumeGameCreditInTransaction(
      session.id,
      client
    );

    if (gameReward) {
      await rewardService.grantRewardInTransaction({
        userId: session.user_id,
        rewardType:
          gameReward.rewardType,
        sourceType:
          gameReward.sourceType || "GAME",
        sourceId:
          gameReward.sourceId ||
          session.id,
        creditAmount:
          gameReward.creditAmount || 0,
        xpAmount:
          gameReward.xpAmount || 0,
        proDays:
          gameReward.proDays || 0,
        metadata:
          gameReward.metadata || {},
        client,
      });
    }

    const completedSession =
      await gameRepository.updateSession(
        session.id,
        {
          status: "COMPLETED",
          result: gameResult || {},
          current_round:
            session.total_rounds || 1,
          completed_at: new Date(),
        },
        client
      );

    await client.query("COMMIT");

    return completedSession;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelGame(
  sessionId,
  reason = null
) {
  if (!sessionId) {
    throw new Error(
      "Game session ID is required"
    );
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const session =
      await gameRepository.findSessionByIdForUpdate(
        sessionId,
        client
      );

    if (!session) {
      throw new Error(
        "Game session not found"
      );
    }

    if (
      session.status === "CANCELLED"
    ) {
      await client.query("COMMIT");
      return session;
    }

    if (
      session.status === "COMPLETED"
    ) {
      throw new Error(
        "Cannot cancel completed game session"
      );
    }

    await creditService.releaseGameCreditInTransaction(
      session.id,
      client
    );

    const metadata = {
      ...(session.metadata || {}),
      cancellation_reason:
        reason || "Game cancelled",
    };

    const cancelledSession =
      await gameRepository.updateSession(
        session.id,
        {
          status: "CANCELLED",
          metadata,
        },
        client
      );

    await client.query("COMMIT");

    return cancelledSession;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getGameType,
  getGameSession,
  startGame,
  completeGame,
  cancelGame,
};
