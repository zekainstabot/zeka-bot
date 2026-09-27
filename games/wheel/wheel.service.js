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

function selectWeightedSegment(segments) {
  const random = Math.random() * MAX_PROBABILITY_TOTAL;

  let cumulativeProbability = 0;

  for (const segment of segments) {
    cumulativeProbability +=
      normalizeProbability(segment.probability);

    if (random < cumulativeProbability) {
      return segment;
    }
  }

  return segments[segments.length - 1];
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
}) {
  if (!userId) {
    throw new Error("User ID is required");
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
      selectWeightedSegment(segments);

    const result = {
      segment_id: selectedSegment.id,
      segment_number:
        selectedSegment.segment_number,
      result_type:
        selectedSegment.result_type,
      credit_amount:
        Number(selectedSegment.credit_amount || 0),
      xp_amount:
        Number(selectedSegment.xp_amount || 0),
      pro_days:
        Number(selectedSegment.pro_days || 0),
      title_key:
        selectedSegment.title_key,
    };

    const completedSession =
      await gameService.completeGame(
        session.id,
        result
      );

    return {
      session: completedSession,
      result,
    };
  } catch (error) {
    try {
      await gameService.cancelGame(
        session.id,
        error.message
      );
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
};
