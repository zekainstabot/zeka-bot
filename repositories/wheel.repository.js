const { getClient } = require("../database/client");

function getDb(client = null) {
  return client || getClient();
}

async function getSegments(gameTypeId, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT
        id,
        game_type_id,
        segment_number,
        title_key,
        result_type,
        credit_amount,
        xp_amount,
        pro_days,
        probability,
        status,
        config,
        created_at,
        updated_at
      FROM wheel_segments
      WHERE game_type_id = $1
        AND status = 'ACTIVE'
      ORDER BY segment_number ASC
    `,
    [gameTypeId]
  );

  return result.rows;
}

async function getSegmentById(id, client = null) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT
        id,
        game_type_id,
        segment_number,
        title_key,
        result_type,
        credit_amount,
        xp_amount,
        pro_days,
        probability,
        status,
        config,
        created_at,
        updated_at
      FROM wheel_segments
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getSegmentByNumber(
  gameTypeId,
  segmentNumber,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT
        id,
        game_type_id,
        segment_number,
        title_key,
        result_type,
        credit_amount,
        xp_amount,
        pro_days,
        probability,
        status,
        config,
        created_at,
        updated_at
      FROM wheel_segments
      WHERE game_type_id = $1
        AND segment_number = $2
      LIMIT 1
    `,
    [gameTypeId, segmentNumber]
  );

  return result.rows[0] || null;
}

async function getAllSegments(
  gameTypeId,
  client = null
) {
  const db = getDb(client);

  const result = await db.query(
    `
      SELECT
        id,
        game_type_id,
        segment_number,
        title_key,
        result_type,
        credit_amount,
        xp_amount,
        pro_days,
        probability,
        status,
        config,
        created_at,
        updated_at
      FROM wheel_segments
      WHERE game_type_id = $1
      ORDER BY segment_number ASC
    `,
    [gameTypeId]
  );

  return result.rows;
}

async function updateSegment(
  id,
  updates,
  client = null
) {
  const db = getDb(client);

  const allowedFields = [
    "segment_number",
    "title_key",
    "result_type",
    "credit_amount",
    "xp_amount",
    "pro_days",
    "probability",
    "status",
    "config",
  ];

  const entries = Object.entries(updates).filter(
    ([field]) => allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return getSegmentById(id, client);
  }

  const values = entries.map(
    ([field, value]) => {
      if (field === "config") {
        return JSON.stringify(value || {});
      }

      return value;
    }
  );

  const setClause = entries
    .map(([field], index) => {
      const parameter = `$${index + 2}`;

      if (field === "config") {
        return `${field} = ${parameter}::JSONB`;
      }

      return `${field} = ${parameter}`;
    })
    .join(", ");

  const result = await db.query(
    `
      UPDATE wheel_segments
      SET
        ${setClause},
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        game_type_id,
        segment_number,
        title_key,
        result_type,
        credit_amount,
        xp_amount,
        pro_days,
        probability,
        status,
        config,
        created_at,
        updated_at
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

module.exports = {
  getSegments,
  getSegmentById,
  getSegmentByNumber,
  getAllSegments,
  updateSegment,
};
