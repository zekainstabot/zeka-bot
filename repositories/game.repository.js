const { getClient } = require("../database/client");

function getDb(client = null) {
  return client || getClient();
}

async function createSession(
  data,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      INSERT INTO game_sessions (
        session_key,
        game_type_id,
        user_id,
        status,
        entry_cost,
        reserved_cost,
        current_round,
        total_rounds,
        metadata,
        expires_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::JSONB, $10
      )
      RETURNING *
    `,
    [
      data.sessionKey,
      data.gameTypeId,
      data.userId || null,
      data.status || "WAITING",
      data.entryCost ?? 0,
      data.reservedCost ?? 0,
      data.currentRound ?? 0,
      data.totalRounds ?? 1,
      JSON.stringify(data.metadata || {}),
      data.expiresAt || null,
    ]
  );

  return result.rows[0];
}

async function findSessionById(
  id,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM game_sessions
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findSessionByIdForUpdate(
  id,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM game_sessions
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findSessionByKey(
  sessionKey,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT *
      FROM game_sessions
      WHERE session_key = $1
      LIMIT 1
    `,
    [sessionKey]
  );

  return result.rows[0] || null;
}

async function updateSession(
  id,
  updates,
  client = null
) {
  const db = getDb(client);

  const allowedFields = [
    "status",
    "reserved_cost",
    "current_round",
    "total_rounds",
    "winner_user_id",
    "result",
    "metadata",
    "started_at",
    "completed_at",
    "expires_at",
  ];

  const entries = Object.entries(updates).filter(
    ([field]) =>
      allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findSessionById(id, client);
  }

  const values = entries.map(
    ([field, value]) => {
      if (
        field === "result" ||
        field === "metadata"
      ) {
        return JSON.stringify(value || {});
      }

      return value;
    }
  );

  const setClause = entries
    .map(([field], index) => {
      const parameter = `$${index + 2}`;

      if (
        field === "result" ||
        field === "metadata"
      ) {
        return `${field} = ${parameter}::JSONB`;
      }

      return `${field} = ${parameter}`;
    })
    .join(", ");

  const result = await db.query(
    `
      UPDATE game_sessions
      SET
        ${setClause},
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

module.exports = {
  createSession,
  findSessionById,
  findSessionByIdForUpdate,
  findSessionByKey,
  updateSession,
};
