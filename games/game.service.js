const creditService = require("../services/credit.service");
const rewardService = require("../services/reward.service");
const gameRepository = require("./game.repository");

async function startGame({
  userId,
  gameTypeId,
  cost,
  metadata = {},
}) {
  const session = await gameRepository.createSession({
    userId,
    gameTypeId,
    status: "WAITING",
    cost,
    metadata,
  });

  try {
    await creditService.reserveGameCredit({
      userId,
      amount: cost,
      gameSessionId: session.id,
    });

    const activeSession = await gameRepository.updateSessionStatus(
      session.id,
      "ACTIVE"
    );

    return activeSession;
  } catch (error) {
    try {
      await gameRepository.updateSessionStatus(
        session.id,
        "FAILED"
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

async function completeGame({
  sessionId,
  reward,
}) {
  const client = await gameRepository.getClient();

  try {
    await client.query("BEGIN");

    const session =
      await gameRepository.findSessionByIdForUpdate(
        sessionId,
        client
      );

    if (!session) {
      throw new Error("Game session not found");
    }

    if (session.status === "COMPLETED") {
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

    await creditService.consumeGameCredit({
      gameSessionId: session.id,
      client,
    });

    await rewardService.grantRewardInTransaction({
      userId: session.user_id,
      reward,
      sourceType: "GAME",
      sourceId: session.id,
      client,
    });

    const completedSession =
      await gameRepository.updateSessionStatus(
        session.id,
        "COMPLETED",
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

async function cancelGame(sessionId) {
  const client = await gameRepository.getClient();

  try {
    await client.query("BEGIN");

    const session =
      await gameRepository.findSessionByIdForUpdate(
        sessionId,
        client
      );

    if (!session) {
      throw new Error("Game session not found");
    }

    if (session.status === "CANCELLED") {
      await client.query("COMMIT");
      return session;
    }

    if (session.status === "COMPLETED") {
      throw new Error(
        "Cannot cancel completed game session"
      );
    }

    await creditService.releaseGameCredit({
      gameSessionId: session.id,
      client,
    });

    const cancelledSession =
      await gameRepository.updateSessionStatus(
        session.id,
        "CANCELLED",
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
  startGame,
  completeGame,
  cancelGame,
};
