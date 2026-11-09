"use strict";

const { createHash, createHmac, randomInt } = require("crypto");
const { getClient } = require("../database/client");

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function hashCode(token, code) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) throw new Error("BOT_TOKEN is not configured");
  return createHmac("sha256", botToken).update(`${token}:${code}`).digest("hex");
}

async function issueWebLoginCode(token, user) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || "")) {
    return { ok: false, reason: "INVALID_LINK" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const db = getClient();
  const result = await db.query(
    `
      UPDATE web_login_challenges
      SET user_id = $2,
          code_hash = $3
      WHERE token_hash = $1
        AND user_id IS NULL
        AND code_hash IS NULL
        AND verified_at IS NULL
        AND expires_at > NOW()
      RETURNING id
    `,
    [hashToken(token), user.id, hashCode(token, code)]
  );

  if (!result.rows[0]) {
    return { ok: false, reason: "EXPIRED_OR_USED" };
  }

  return { ok: true, code };
}

module.exports = { issueWebLoginCode };
