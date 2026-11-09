"use strict";

const { createHash, randomBytes } = require("crypto");
const { getClient } = require("../database/client");

function hashLoginCode(code) {
  return createHash("sha256").update(code).digest("hex");
}

async function getOrCreateWebLoginCode(user) {
  if (!user?.id) throw new Error("User is required");
  const db = getClient();

  const existing = await db.query(
    `SELECT id FROM web_login_credentials
     WHERE user_id = $1 AND revoked_at IS NULL LIMIT 1`,
    [user.id]
  );

  if (existing.rows[0]) return { code: null, existing: true };

  const code = randomBytes(18).toString("base64url").toUpperCase();
  await db.query(
    `INSERT INTO web_login_credentials (user_id, code_hash)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET code_hash = EXCLUDED.code_hash,
           updated_at = NOW(),
           revoked_at = NULL`,
    [user.id, hashLoginCode(code)]
  );

  return { code, existing: false };
}

async function regenerateWebLoginCode(user) {
  if (!user?.id) throw new Error("User is required");
  const code = randomBytes(18).toString("base64url").toUpperCase();
  const db = getClient();

  await db.query(
    `INSERT INTO web_login_credentials (user_id, code_hash)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET code_hash = EXCLUDED.code_hash,
           updated_at = NOW(),
           revoked_at = NULL`,
    [user.id, hashLoginCode(code)]
  );

  return code;
}

module.exports = { getOrCreateWebLoginCode, regenerateWebLoginCode };
