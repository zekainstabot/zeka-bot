const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_rollout_events_archive (
        rollout_id,
        event_id,
        event_type,
        event_data,
        occurred_at,
        archived_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      data.rolloutId,
      data.eventId || null,
      data.eventType,
      data.eventData || null,
      data.occurredAt || new Date(),
      data.archivedAt || new Date(),
    ]
  );

  return result.rows[0];
}

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_events_archive
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
      FROM download_strategy_rollout_events_archive
      WHERE rollout_id = $1
      ORDER BY occurred_at DESC
      LIMIT $2
    `,
    [rolloutId, safeLimit]
  );

  return result.rows;
}

async function findByEventType(eventType, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_events_archive
      WHERE event_type = $1
      ORDER BY occurred_at DESC
      LIMIT $2
    `,
    [eventType, safeLimit]
  );

  return result.rows;
}

async function findByDateRange(
  rolloutId,
  fromDate,
  toDate,
  limit = 500
) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_rollout_events_archive
      WHERE rollout_id = $1
        AND occurred_at >= $2
        AND occurred_at <= $3
      ORDER BY occurred_at DESC
      LIMIT $4
    `,
    [rolloutId, fromDate, toDate, safeLimit]
  );

  return result.rows;
}

async function deleteByRolloutId(rolloutId) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM download_strategy_rollout_events_archive
      WHERE rollout_id = $1
    `,
    [rolloutId]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByRolloutId,
  findByEventType,
  findByDateRange,
  deleteByRolloutId,
};
