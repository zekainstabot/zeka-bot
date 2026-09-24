const { getClient } = require("../database/client");

async function getActive() {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM required_channel_settings
      WHERE is_active = TRUE
      ORDER BY id ASC
      LIMIT 1
    `
  );

  return result.rows[0] || null;
}

async function findByChannelId(channelId) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM required_channel_settings
      WHERE channel_id = $1
      LIMIT 1
    `,
    [channelId]
  );

  return result.rows[0] || null;
}

async function create(data) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO required_channel_settings (
        channel_id,
        channel_username,
        channel_title,
        is_enabled,
        is_active,
        invite_link,
        verification_mode,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      data.channelId,
      data.channelUsername || null,
      data.channelTitle || null,
      data.isEnabled === true,
      data.isActive !== false,
      data.inviteLink || null,
      data.verificationMode || "MEMBERSHIP",
      data.createdBy || null,
    ]
  );

  return result.rows[0];
}

async function update(channelId, updates) {
  const db = getClient();

  const allowedFields = [
    "channel_username",
    "channel_title",
    "is_enabled",
    "is_active",
    "invite_link",
    "verification_mode",
  ];

  const entries = Object.entries(updates).filter(([field]) =>
    allowedFields.includes(field)
  );

  if (entries.length === 0) {
    return findByChannelId(channelId);
  }

  const values = entries.map(([, value]) => value);

  const setClause = entries
    .map(([field], index) => `${field} = $${index + 2}`)
    .join(", ");

  const result = await db.query(
    `
      UPDATE required_channel_settings
      SET ${setClause},
          updated_at = NOW()
      WHERE channel_id = $1
      RETURNING *
    `,
    [channelId, ...values]
  );

  return result.rows[0] || null;
}

async function disable(channelId) {
  return update(channelId, {
    is_enabled: false,
  });
}

async function deactivate(channelId) {
  return update(channelId, {
    is_active: false,
    is_enabled: false,
  });
}

module.exports = {
  getActive,
  findByChannelId,
  create,
  update,
  disable,
  deactivate,
};
