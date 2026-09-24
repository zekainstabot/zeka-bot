const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO download_strategy_experiments (
        platform_id,
        experiment_name,
        description,
        status,
        traffic_percentage,
        configuration,
        starts_at,
        ends_at,
        created_by,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      data.platformId,
      data.experimentName,
      data.description || null,
      data.status || "DRAFT",
      data.trafficPercentage ?? 0,
      data.configuration || null,
      data.startsAt || null,
      data.endsAt || null,
      data.createdBy || null,
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
      FROM download_strategy_experiments
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByPlatformId(platformId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_experiments
      WHERE platform_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [platformId, safeLimit]
  );

  return result.rows;
}

async function findActiveByPlatformId(platformId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM download_strategy_experiments
      WHERE platform_id = $1
        AND status = 'RUNNING'
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at > NOW())
      ORDER BY id DESC
    `,
    [platformId]
  );

  return result.rows;
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "experiment_name",
    "description",
    "status",
    "traffic_percentage",
    "configuration",
    "starts_at",
    "ends_at",
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
      UPDATE download_strategy_experiments
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function start(id) {
  return update(id, {
    status: "RUNNING",
    starts_at: new Date(),
  });
}

async function pause(id) {
  return update(id, {
    status: "PAUSED",
  });
}

async function complete(id) {
  return update(id, {
    status: "COMPLETED",
    ends_at: new Date(),
  });
}

async function cancel(id) {
  return update(id, {
    status: "CANCELLED",
    ends_at: new Date(),
  });
}

module.exports = {
  create,
  findById,
  findByPlatformId,
  findActiveByPlatformId,
  update,
  start,
  pause,
  complete,
  cancel,
};
