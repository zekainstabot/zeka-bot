const { getClient } = require("../database/client");

async function findById(id) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM user_channel_destinations
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function findActiveByUserId(userId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM user_channel_destinations
      WHERE user_id = $1
        AND is_active = TRUE
      ORDER BY created_at ASC
    `,
    [userId]
  );

  return result.rows;
}

async function findActiveByUserAndChannel(userId, channelId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM user_channel_destinations
      WHERE user_id = $1
        AND channel_id = $2
        AND is_active = TRUE
      LIMIT 1
    `,
    [userId, channelId]
  );

  return result.rows[0] || null;
}

async function create(destination) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO user_channel_destinations (
        user_id,
        channel_id,
        channel_username,
        channel_title,
        is_active,
        bot_is_admin,
        can_post_messages,
        caption_template,
        connected_at,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, NOW(), $9
      )
      RETURNING *
    `,
    [
      destination.userId,
      destination.channelId,
      destination.channelUsername || null,
      destination.channelTitle || null,
      destination.isActive !== false,
      destination.botIsAdmin === true,
      destination.canPostMessages === true,
      destination.captionTemplate || null,
      destination.metadata || null,
    ]
  );

  return result.rows[0];
}

async function update(id, updates) {
  const db = getClient();

  const allowedFields = [
    "channel_username",
    "channel_title",
    "is_active",
    "bot_is_admin",
    "can_post_messages",
    "caption_template",
    "disconnected_at",
    "last_verified_at",
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
      UPDATE user_channel_destinations
      SET ${setClause},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return result.rows[0] || null;
}

async function deactivate(id) {
  const db = getClient();

  const result = await db.query(
    `
      UPDATE user_channel_destinations
      SET
        is_active = FALSE,
        disconnected_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  findById,
  findActiveByUserId,
  findActiveByUserAndChannel,
  create,
  update,
  deactivate,
};
