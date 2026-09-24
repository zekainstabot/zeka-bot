const { getClient } = require("../database/client");

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO feedback (
        user_id,
        request_id,
        job_id,
        platform,
        rating,
        feedback_type,
        message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      data.userId,
      data.requestId || null,
      data.jobId || null,
      data.platform || null,
      data.rating ?? null,
      data.feedbackType || "GENERAL",
      data.message || null,
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
      FROM feedback
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findByUserId(userId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM feedback
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  );

  return result.rows;
}

async function findByRequestId(requestId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM feedback
      WHERE request_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [requestId, safeLimit]
  );

  return result.rows;
}

async function findByJobId(jobId, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM feedback
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [jobId, safeLimit]
  );

  return result.rows;
}

async function findByType(feedbackType, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM feedback
      WHERE feedback_type = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [feedbackType, safeLimit]
  );

  return result.rows;
}

async function findByPlatform(platform, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM feedback
      WHERE platform = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [platform, safeLimit]
  );

  return result.rows;
}

async function findByRating(rating, limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM feedback
      WHERE rating = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [rating, safeLimit]
  );

  return result.rows;
}

async function findAll(limit = 100) {
  const db = getClient();

  const safeLimit = Math.max(
    1,
    Math.min(Number(limit) || 100, 500)
  );

  const result = await db.query(
    `
      SELECT *
      FROM feedback
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function deleteById(id) {
  const db = getClient();

  const result = await db.query(
    `
      DELETE FROM feedback
      WHERE id = $1
    `,
    [id]
  );

  return result.rowCount;
}

module.exports = {
  create,
  findById,
  findByUserId,
  findByRequestId,
  findByJobId,
  findByType,
  findByPlatform,
  findByRating,
  findAll,
  deleteById,
};
