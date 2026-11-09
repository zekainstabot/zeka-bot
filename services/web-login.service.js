"use strict";

const { createHash, randomBytes } = require("crypto");
const { getClient } = require("../database/client");

function hashLoginCode(code) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function createStrongLoginCode() {
  // 128 bits from the OS CSPRNG; 32 uppercase hexadecimal characters.
  return randomBytes(16).toString("hex").toUpperCase();
}

async function getOrCreateWebLoginCode(user) {
  if (!user?.id) throw new Error("User is required");
  const db = getClient();
  const code = createStrongLoginCode();

  const inserted = await db.query(
    `INSERT INTO web_login_credentials (user_id, code_hash)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING id`,
    [user.id, hashLoginCode(code)]
  );

  if (!inserted.rows[0]) {
    return { code: null, existing: true };
  }

  return { code, existing: false };
}

async function regenerateWebLoginCode(user) {
  if (!user?.id) throw new Error("User is required");
  const code = createStrongLoginCode();
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
