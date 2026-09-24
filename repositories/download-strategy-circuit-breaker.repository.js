const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_circuit_breakers (
        strategy_id,
        state,
        failure_threshold,
        success_threshold,
        failure_count,
        success_count,
        opened_at,
        closed_at,
        last_failure_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      data.strategyId,
      data.state || "CLOSED",
      data.failureThreshold ?? 5,
      data.successThreshold ?? 2,
      data.failureCount ?? 0,
      data.successCount ?? 0,
      data.openedAt || null,
      data.closedAt || null,
      data.lastFailureAt || null,
      data.metadata || null,
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_circuit_breakers
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByStrategyId(strategyId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_circuit_breakers
      WHERE strategy_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [strategyId]
  );

  return result.rows[0] || null;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "state",
    "failure_threshold",
    "success_threshold",
    "failure_count",
    "success_count",
    "opened_at",
    "closed_at",
    "last_failure_at",
    "metadata",
  ];

  const entries = Object.entries(updates).filter(([field]) =>
    allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findById(id);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 2}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE download_strategy_circuit_breakers
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function open(id) {
  return update(id, {
    state: "OPEN",
    opened_at: new Date(),
  });
}

async function close(id) {
  return update(id, {
    state: "CLOSED",
    closed_at: new Date(),
    failure_count: 0,
    success_count: 0,
  });
}

async function halfOpen(id) {
  return update(id, {
    state: "HALF_OPEN",
  });
}

async function recordFailure(id) {
  const circuit = await findById(id);

  if (!circuit) {
    return null;
  }

  const failureCount = Number(circuit.failure_count || 0) + 1;
  const threshold = Number(circuit.failure_threshold || 5);

  return update(id, {
    failure_count: failureCount,
    success_count: 0,
    last_failure_at: new Date(),
    ...(failureCount >= threshold
      ? {
          state: "OPEN",
          opened_at: new Date(),
        }
      : {}),
  });
}

async function recordSuccess(id) {
  const circuit = await findById(id);

  if (!circuit) {
    return null;
  }

  const successCount = Number(circuit.success_count || 0) + 1;
  const threshold = Number(circuit.success_threshold || 2);

  return update(id, {
    success_count: successCount,
    failure_count: 0,
    ...(circuit.state === "HALF_OPEN" && successCount >= threshold
      ? {
          state: "CLOSED",
          closed_at: new Date(),
        }
      : {}),
  });
}

module.exports = {
  create,
  findById,
  findByStrategyId,
  update,
  open,
  close,
  halfOpen,
  recordFailure,
  recordSuccess,
};
