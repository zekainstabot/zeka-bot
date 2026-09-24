const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_alerts (
        rollout_id,
        alert_type,
        severity,
        status,
        message,
        threshold,
        current_value,
        triggered_at,
        resolved_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      data.rolloutId,
      data.alertType,
      data.severity || "WARNING",
      data.status || "OPEN",
      data.message || null,
      data.threshold ?? null,
      data.currentValue ?? null,
      data.triggeredAt || new Date(),
      data.resolvedAt || null,
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
      FROM download_strategy_rollout_alerts
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByRolloutId(rolloutId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_alerts
      WHERE rollout_id = $1
      ORDER BY triggered_at DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findOpenByRolloutId(rolloutId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_alerts
      WHERE rollout_id = $1
        AND status = 'OPEN'
      ORDER BY triggered_at DESC
    `,
    [rolloutId]
  );

  return result.rows;
}

async function findByType(alertType, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_alerts
      WHERE alert_type = $1
      ORDER BY triggered_at DESC
      LIMIT $2
    `,
    [alertType, safeLimit]
  );

  return result.rows;
}

async function resolve(id, metadata = null) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE download_strategy_rollout_alerts
      SET status = 'RESOLVED',
          resolved_at = NOW(),
          metadata = COALESCE($2, metadata),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, metadata]
  );

  return result.rows[0] || null;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "alert_type",
    "severity",
    "status",
    "message",
    "threshold",
    "current_value",
    "triggered_at",
    "resolved_at",
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
      UPDATE download_strategy_rollout_alerts
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

module.exports = {
  create,
  findById,
  findByRolloutId,
  findOpenByRolloutId,
  findByType,
  resolve,
  update,
};
