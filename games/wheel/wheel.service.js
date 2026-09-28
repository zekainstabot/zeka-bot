const gameService = require("../game.service");
const wheelRepository = require("../../repositories/wheel.repository");

const WHEEL_GAME_KEY = "wheel_of_fortune";
const MAX_PROBABILITY_TOTAL = 100;
const PROBABILITY_TOLERANCE = 0.0001;

function normalizeProbability(value) {
  const probability = Number(value);

  if (!Number.isFinite(probability) || probability < 0) {
    throw new Error(
      `Invalid wheel probability: ${value}`
    );
  }

  return probability;
}

function validateSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error(
      "No active wheel segments found"
    );
  }

  let totalProbability = 0;

  for (const segment of segments) {
    const probability =
      normalizeProbability(segment.probability);

    totalProbability += probability;
  }

  if (
    Math.abs(
      totalProbability - MAX_PROBABILITY_TOTAL
    ) > PROBABILITY_TOLERANCE
  ) {
    throw new Error(
      `Wheel probabilities must total 100. Current total: ${totalProbability}`
    );
  }

  return true;
}

function selectWeightedSegment(
  segments,
  diceValue = null
) {
  let pool = segments;

  if (diceValue !== null) {
    const numericDiceValue = Number(diceValue);

    if (
      !Number.isInteger(numericDiceValue) ||
      numericDiceValue < 1 ||
      numericDiceValue > 6
    ) {
      throw new Error(
        `Invalid Telegram dice value: ${diceValue}`
      );
    }

    /*
     * Telegram dice:
     *
     * 1, 2, 3 = 50% پوچ
     * 4, 5, 6 = 50% برد
     */

    pool =
      numericDiceValue <= 3
        ? segments.filter(
            (segment) =>
              String(
                segment.result_type
              ).toUpperCase() === "BLANK"
          )
        : segments.filter(
            (segment) =>
              String(
                segment.result_type
              ).toUpperCase() !== "BLANK"
          );

    if (pool.length === 0) {
      throw new Error(
        `No wheel segments available for dice result: ${numericDiceValue}`
      );
    }
  }

  const totalProbability =
    pool.reduce(
      (total, segment) =>
        total +
        normalizeProbability(
          segment.probability
        ),
      0
    );

  if (totalProbability <= 0) {
    throw new Error(
      "Wheel segment probability pool is empty"
    );
  }

  const random =
    Math.random() * totalProbability;

  let cumulativeProbability = 0;

  for (const segment of pool) {
    cumulativeProbability +=
      normalizeProbability(
        segment.probability
      );

    if (
      random <
      cumulativeProbability
    ) {
      return segment;
    }
  }

  return pool[pool.length - 1];
}

function buildWheelReward(
  selectedSegment,
  gameSessionId
) {
  const resultType =
    String(
      selectedSegment.result_type || ""
    ).toUpperCase();

  const creditAmount =
    Number(
      selectedSegment.credit_amount || 0
    );

  const xpAmount =
    Number(
      selectedSegment.xp_amount || 0
    );

  const proDays =
    Number(
      selectedSegment.pro_days || 0
    );

  if (resultType === "CREDIT") {
    if (
      !Number.isFinite(creditAmount) ||
      creditAmount <= 0
    ) {
      throw new Error(
        `Invalid wheel credit reward: ${creditAmount}`
      );
    }

    return {
      rewardType: "WHEEL_CREDIT",
      sourceType: "GAME",
      sourceId: gameSessionId,
      creditAmount,
      xpAmount: 0,
      proDays: 0,
      metadata: {
        game: WHEEL_GAME_KEY,
        resultType,
        segmentId:
          selectedSegment.id,
        segmentNumber:
          selectedSegment.segment_number,
      },
    };
  }

  if (resultType === "XP") {
    if (
      !Number.isInteger(xpAmount) ||
      xpAmount <= 0
    ) {
      throw new Error(
        `Invalid wheel XP reward: ${xpAmount}`
      );
    }

    return {
      rewardType: "WHEEL_XP",
      sourceType: "GAME",
      sourceId: gameSessionId,
      creditAmount: 0,
      xpAmount,
      proDays: 0,
      metadata: {
        game: WHEEL_GAME_KEY,
        resultType,
        segmentId:
          selectedSegment.id,
        segmentNumber:
          selectedSegment.segment_number,
      },
    };
  }

  if (resultType === "PRO") {
    if (
      !Number.isInteger(proDays) ||
      proDays <= 0
    ) {
      throw new Error(
        `Invalid wheel Pro reward: ${proDays}`
      );
    }

    return {
      rewardType: "WHEEL_PRO",
      sourceType: "GAME",
      sourceId: gameSessionId,
      creditAmount: 0,
      xpAmount: 0,
      proDays,
      metadata: {
        game: WHEEL_GAME_KEY,
        resultType,
        segmentId:
          selectedSegment.id,
        segmentNumber:
          selectedSegment.segment_number,
      },
    };
  }

  if (resultType === "BLANK") {
    return null;
  }

  throw new Error(
    `Unsupported wheel result type: ${resultType}`
  );
}

async function getWheelSegments() {
  const gameType =
    await gameService.getGameType(
      WHEEL_GAME_KEY
    );

  const segments =
    await wheelRepository.getSegments(
      gameType.id
    );

  validateSegments(segments);

  return segments;
}

async function startSpin({
  userId,
  metadata = {},
  diceValue = null,
}) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  const gameType =
    await gameService.getGameType(
      WHEEL_GAME_KEY
    );

  const segments =
    await wheelRepository.getSegments(
      gameType.id
    );

  validateSegments(segments);

  const session =
    await gameService.startGame({
      userId,
      gameKey: WHEEL_GAME_KEY,
      totalRounds: 1,
      metadata: {
        ...metadata,
        game: WHEEL_GAME_KEY,
      },
    });

  try {
    const selectedSegment =
      selectWeightedSegment(
        segments,
        diceValue
      );

    const result = {
      segment_id:
        selectedSegment.id,

      segment_number:
        selectedSegment.segment_number,

      result_type:
        selectedSegment.result_type,

      credit_amount:
        Number(
          selectedSegment.credit_amount || 0
        ),

      xp_amount:
        Number(
          selectedSegment.xp_amount || 0
        ),

      pro_days:
        Number(
          selectedSegment.pro_days || 0
        ),

      title_key:
        selectedSegment.title_key,
    };

    const reward =
      buildWheelReward(
        selectedSegment,
        session.id
      );

    const completedSession =
      await gameService.completeGame(
        session.id,
        result,
        reward
      );

    return {
      session: completedSession,
      result,
    };
  } catch (error) {
    try {
      const currentSession =
        await gameService.getGameSession(
          session.id
        );

      if (
        currentSession &&
        currentSession.status !== "COMPLETED" &&
        currentSession.status !== "CANCELLED" &&
        currentSession.status !== "FAILED"
      ) {
        await gameService.cancelGame(
          session.id,
          error.message
        );
      }
    } catch (cancelError) {
      console.error(
        `Failed to cancel wheel session ${session.id}:`,
        cancelError
      );
    }

    throw error;
  }
}

module.exports = {
  WHEEL_GAME_KEY,
  getWheelSegments,
  startSpin,
  validateSegments,
  selectWeightedSegment,
  buildWheelReward,
};
